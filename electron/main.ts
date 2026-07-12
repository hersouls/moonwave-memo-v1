/**
 * Electron main process (Phase 2, Milestones 1 & 2).
 *
 * Wraps the existing Vite renderer as a desktop app and exposes native filesystem
 * operations to the sync-folder feature over IPC — the FileSyncTarget backend swap
 * the Phase 1 abstraction was built for. No permission re-prompts; NAS/network paths
 * work like any local folder. M2 adds a chokidar watcher that streams external .md
 * edits back to the renderer for reverse sync (§4.4).
 *
 * Security posture: contextIsolation on, nodeIntegration off, a minimal preload
 * bridge, and every fs path validated to stay inside the user-chosen root.
 */
import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, type WebContents } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import chokidar, { type FSWatcher } from 'chokidar'
import { autoUpdater } from 'electron-updater'

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:3000'
// Packaged app loads the hosted https site (not the local app:// bundle) so Firebase
// Google auth works — a custom app:// origin isn't an authorized OAuth domain (§Phase 2 login).
const PROD_URL = 'https://memo.moonwave.kr'
// Packaged layout: resources/app/electron/out/main.cjs + resources/app/dist/.
// From electron/out, the renderer dist is two levels up.
const RENDERER_DIR = path.join(__dirname, '..', '..', 'dist')

// A custom privileged scheme lets the SPA load with absolute `/assets/...` paths and
// client-side routing working, unlike file:// (which breaks both).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#18181b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Firebase/Google auth opens a popup via window.open. Allow the auth popups to open
  // as child windows; route any other external link to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(accounts\.google\.com|[\w-]+\.firebaseapp\.com)/.test(url) || url.includes('/__/auth/')) {
      return { action: 'allow' }
    }
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Hosted https origin → Google auth works; the preload still injects the native fs
    // bridge, so the sync-folder feature uses the native backend. Needs internet to start.
    win.loadURL(PROD_URL)
  }
}

/** Serve the built renderer from the custom scheme, with SPA fallback to index.html. */
function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel === '') rel = '/index.html'

    const target = path.join(RENDERER_DIR, rel)
    // Never serve outside the renderer dir.
    if (!target.startsWith(RENDERER_DIR)) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      await fs.access(target)
      return net.fetch(pathToFileURL(target).toString())
    } catch {
      // Unknown path with no file extension → SPA route → serve index.html.
      if (!path.extname(rel)) {
        return net.fetch(pathToFileURL(path.join(RENDERER_DIR, 'index.html')).toString())
      }
      return new Response('Not found', { status: 404 })
    }
  })
}

// ─── fs IPC: path safety ─────────────────────────────

/** Resolve relPath under root, refusing anything that escapes the root folder. */
function resolveWithin(root: string, relPath: string): string {
  const target = path.resolve(root, relPath)
  const rel = path.relative(root, target)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`경로가 루트를 벗어납니다: ${relPath}`)
  }
  return target
}

function registerFsHandlers(): void {
  ipcMain.handle('syncFolder:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '동기화 폴더 선택',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = result.filePaths[0]
    return { path: dir, name: path.basename(dir) }
  })

  ipcMain.handle('syncFolder:writeText', async (_e, root: string, relPath: string, text: string) => {
    const target = resolveWithin(root, relPath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, text, 'utf-8')
  })

  ipcMain.handle('syncFolder:writeBinary', async (_e, root: string, relPath: string, data: ArrayBuffer) => {
    const target = resolveWithin(root, relPath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, Buffer.from(data))
  })

  ipcMain.handle('syncFolder:deleteFile', async (_e, root: string, relPath: string) => {
    const target = resolveWithin(root, relPath)
    await fs.rm(target, { force: true })
  })

  ipcMain.handle('syncFolder:exists', async (_e, root: string, relPath: string) => {
    try {
      await fs.access(resolveWithin(root, relPath))
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('syncFolder:dirExists', async (_e, root: string) => {
    try {
      const stat = await fs.stat(root)
      return stat.isDirectory()
    } catch {
      return false
    }
  })

  ipcMain.handle('syncFolder:listPaths', async (_e, root: string) => {
    const out: string[] = []
    async function walk(dir: string, prefix: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel)
        else out.push(rel)
      }
    }
    try {
      await walk(root, '')
    } catch {
      /* root missing → empty list */
    }
    return out
  })
}

// ─── File watching (Phase 2 M2 · reverse sync) ───────

let watcher: FSWatcher | null = null

function toRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/')
}

/** Only surface user .md files; skip the assets/ image dir and dotfiles/.trash. */
function shouldHandle(rel: string): boolean {
  if (!rel.toLowerCase().endsWith('.md')) return false
  const parts = rel.split('/')
  return !parts.some((p) => p === 'assets' || p.startsWith('.'))
}

async function emitFileEvent(
  sender: WebContents,
  type: 'add' | 'change' | 'unlink',
  root: string,
  abs: string,
): Promise<void> {
  const rel = toRel(root, abs)
  if (!shouldHandle(rel)) return
  if (type === 'unlink') {
    sender.send('syncFolder:fileEvent', { type, relPath: rel })
    return
  }
  try {
    const content = await fs.readFile(abs, 'utf-8')
    sender.send('syncFolder:fileEvent', { type, relPath: rel, content })
  } catch {
    /* file vanished between event and read */
  }
}

function registerWatchHandlers(): void {
  ipcMain.on('syncFolder:startWatch', (e, root: string) => {
    if (watcher) { void watcher.close(); watcher = null }
    // ignoreInitial: the app owns the initial state; awaitWriteFinish debounces
    // partial/atomic writes so we read a settled file (§4.6).
    watcher = chokidar.watch(root, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
      ignored: (p: string) => path.basename(p).startsWith('.'),
    })
    watcher
      .on('add', (p) => void emitFileEvent(e.sender, 'add', root, p))
      .on('change', (p) => void emitFileEvent(e.sender, 'change', root, p))
      .on('unlink', (p) => void emitFileEvent(e.sender, 'unlink', root, p))
  })

  ipcMain.on('syncFolder:stopWatch', () => {
    if (watcher) { void watcher.close(); watcher = null }
  })
}

app.whenReady().then(() => {
  if (!isDev) registerAppProtocol()
  registerFsHandlers()
  registerWatchHandlers()
  createWindow()

  // Auto-update from GitHub Releases (§10). Only in a packaged build; downloads +
  // notifies, then installs on quit. Requires signed releases to apply on macOS.
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => console.error('Update check failed:', err))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
