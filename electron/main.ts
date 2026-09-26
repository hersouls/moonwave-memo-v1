/**
 * Electron main process.
 *
 * The window loads the LIVE site (https://memo.moonwave.kr) — Firebase Google sign-in
 * needs a real https origin — and the preload exposes native filesystem operations to
 * the sync-folder feature over IPC (the FileSyncTarget backend swap), plus a chokidar
 * watcher that streams external .md edits back for reverse sync (§4.4).
 *
 * Security model (docs/ELECTRON_BUILD.md "보안 모델"):
 *  - Renderer: sandbox + contextIsolation, no nodeIntegration, a minimal preload bridge.
 *  - IPC: every handler first checks that the sender is the main frame of the main
 *    window on the app origin (security.ts isTrustedIpcSender).
 *  - Folders: roots come only from native dialogs shown here (folder picker, or a
 *    one-time confirm for a root saved by an older version) and are kept in an allowlist
 *    in userData (rootStore.ts). Every file op re-validates the root against it
 *    (realpath-normalized), keeps the relative-path traversal check and refuses symlink
 *    escapes — the renderer can no longer name an arbitrary folder.
 *  - Windows: only the Google sign-in popup opens in-app (sandboxed, no preload); other
 *    links go to the system browser; the main window can't navigate off the app origin.
 *  - Writes are atomic (temp file + fsync + rename); one app instance at a time.
 */
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type MessageBoxOptions,
  type OpenDialogOptions,
  type WebContents,
} from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import { autoUpdater } from 'electron-updater'
import {
  APP_ORIGIN,
  DEV_ORIGIN,
  SyncFolderAccessError,
  appOrigins,
  assertRealPathInside,
  decideNavigation,
  decideWindowOpen,
  isLegacyRootCandidate,
  isSameOrInside,
  isTrustedIpcSender,
  realpathSafe,
  resolveWithin,
  samePath,
  shouldWatchRelPath,
  validateRootInput,
  type IpcSenderInfo,
} from './security'
import { RootStore, ROOT_STORE_FILE, hasPriorWebData } from './rootStore'
import { writeFileAtomic } from './atomicWrite'

const isPackaged = app.isPackaged
const PROD_URL = `${APP_ORIGIN}/`
const DEV_URL = `${DEV_ORIGIN}/`
// Unpackaged runs load the Vite dev server; MEMO_DESKTOP_LIVE=1 loads the live site
// instead (to try the production setup locally). A packaged app always loads the live site.
const START_URL = isPackaged || process.env.MEMO_DESKTOP_LIVE === '1' ? PROD_URL : DEV_URL
const ALLOWED_ORIGINS = appOrigins(isPackaged)

const NOT_ALLOWED_MESSAGE =
  '이 폴더는 아직 허용되지 않았습니다. 설정 › 동기화 폴더에서 “폴더 다시 연결” 또는 “폴더 변경”으로 폴더를 한 번 다시 선택해 주세요.'

let mainWindow: BrowserWindow | null = null
let rootStore: RootStore | null = null
/** realpath(userData) — never readable/writable through the bridge (the allowlist lives there). */
let forbiddenRoots: string[] = []

// ─── Window ──────────────────────────────────────────

function focusMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } else if (rootStore) {
    // start() has finished (it creates the first window right after loading the store).
    createWindow()
  }
}

/** Popups we allow (Google sign-in) get no bridge and can't spawn in-app windows themselves. */
function hardenPopup(child: BrowserWindow): void {
  child.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideWindowOpen(url)
    if (decision.action === 'external') openExternal(decision.url)
    return { action: 'deny' }
  })
  child.webContents.on('will-navigate', (event) => {
    if (!/^https?:$/.test(safeProtocol(event.url))) event.preventDefault()
  })
}

/** Hand an http(s) URL (already vetted by security.ts) to the system browser. */
function openExternal(url: string): void {
  shell.openExternal(url).catch((err) => console.error('openExternal failed:', err))
}

function safeProtocol(url: string): string {
  try {
    return new URL(url).protocol
  } catch {
    return ''
  }
}

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Read by the (sandboxed) preload: the real app version for the web app's
      // "설치된 버전" line, and the origins it may expose the bridge to.
      additionalArguments: [`--memo-version=${app.getVersion()}`, `--memo-origins=${ALLOWED_ORIGINS.join(',')}`],
    },
  })
  mainWindow = win

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
      stopWatcher()
    }
  })

  // Firebase signInWithPopup opens the auth handler with window.open. Only that popup
  // opens in-app — explicitly without the preload and sandboxed; any other http(s) link
  // goes to the system browser; everything else is refused.
  win.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideWindowOpen(url)
    if (decision.action === 'auth-popup') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            preload: undefined,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: false,
            webviewTag: false,
          },
        },
      }
    }
    if (decision.action === 'external') openExternal(decision.url)
    return { action: 'deny' }
  })
  win.webContents.on('did-create-window', (child) => hardenPopup(child))

  // The main frame stays on the app origin: external http(s) → system browser, else blocked.
  // (e.g. the desktop download: /api/download-desktop 302s to GitHub → opens in the browser.)
  const guardNavigation = (event: Electron.Event, url: string, isMainFrame: boolean) => {
    if (!isMainFrame) return
    const decision = decideNavigation(url, ALLOWED_ORIGINS)
    if (decision.action === 'allow') return
    event.preventDefault()
    if (decision.action === 'external') openExternal(decision.url)
  }
  win.webContents.on('will-navigate', (event) => guardNavigation(event, event.url, event.isMainFrame))
  win.webContents.on('will-redirect', (event) => guardNavigation(event, event.url, event.isMainFrame))

  win.loadURL(START_URL).catch((err) => console.error(`Failed to load ${START_URL}:`, err))
  if (!isPackaged) win.webContents.openDevTools({ mode: 'detach' })
}

// ─── IPC sender check ────────────────────────────────

function senderInfo(event: IpcMainInvokeEvent | IpcMainEvent): IpcSenderInfo {
  const wc = event.sender
  let frameIsMain = false
  let frameOrigin: string | null = null
  try {
    const frame = event.senderFrame
    if (frame && !frame.detached) {
      frameIsMain = frame.parent === null && frame.frameTreeNodeId === wc.mainFrame.frameTreeNodeId
      frameOrigin = frame.origin
    }
  } catch {
    /* frame disposed mid-call → untrusted */
  }
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
  return { senderId: wc.id, mainWindowId: win ? win.webContents.id : null, frameIsMain, frameOrigin }
}

function isTrusted(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  const ok = isTrustedIpcSender(senderInfo(event), ALLOWED_ORIGINS)
  if (!ok) console.warn('[security] rejected IPC from', safeFrameUrl(event))
  return ok
}

function safeFrameUrl(event: IpcMainInvokeEvent | IpcMainEvent): string {
  try {
    return event.senderFrame?.url ?? '(no frame)'
  } catch {
    return '(disposed frame)'
  }
}

/** ipcMain.handle with the sender check in front of every call. */
function handle(channel: string, fn: (...args: unknown[]) => Promise<unknown>): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    if (!isTrusted(event)) throw new Error('허용되지 않은 호출입니다.')
    return fn(...args)
  })
}

// ─── Root allowlist + native dialogs ─────────────────

function store(): RootStore {
  if (!rootStore) throw new Error('root store not loaded')
  return rootStore
}

const pathKey = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p)

/** Visible main window to parent a dialog to; otherwise the dialog is app-modal. */
function dialogParent(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() ? mainWindow : null
}

// One native dialog at a time (legacy confirms can queue up for several roots).
let dialogChain: Promise<unknown> = Promise.resolve()
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = dialogChain.then(fn, fn)
  dialogChain = run.catch(() => {})
  return run
}

function showOpenDialog(options: OpenDialogOptions) {
  return serialized(() => {
    const parent = dialogParent()
    return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
  })
}

function showMessageBox(options: MessageBoxOptions) {
  return serialized(() => {
    const parent = dialogParent()
    return parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options)
  })
}

/** Roots declined in the legacy confirm this session (no re-prompt until restart/reconnect). */
const declinedLegacy = new Set<string>()
const pendingLegacy = new Map<string, Promise<boolean>>()
let legacyPromptCount = 0
const MAX_LEGACY_PROMPTS_PER_SESSION = 5

/**
 * One-time migration for a root saved before the allowlist existed: within the legacy
 * window (upgrades only), ask the user — in a native dialog the page can't script — to
 * keep using that exact folder. Approved roots are recorded; declined ones need the
 * picker ("폴더 다시 연결"/"폴더 변경").
 */
function confirmLegacyRoot(displayPath: string, realRoot: string): Promise<boolean> {
  const key = pathKey(realRoot)
  // Concurrent requests for the same root share one dialog.
  const pending = pendingLegacy.get(key)
  if (pending) return pending
  if (
    !store().isLegacyWindowOpen() ||
    declinedLegacy.has(key) ||
    legacyPromptCount >= MAX_LEGACY_PROMPTS_PER_SESSION ||
    !isLegacyRootCandidate(realRoot, forbiddenRoots)
  ) {
    return Promise.resolve(false)
  }
  legacyPromptCount++

  const decision = (async () => {
    const stat = await fs.stat(realRoot).catch(() => null)
    if (!stat?.isDirectory()) return false
    const { response } = await showMessageBox({
      type: 'question',
      buttons: ['허용', '허용 안 함'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: '동기화 폴더 접근 확인',
      message: '이전에 지정한 동기화 폴더를 계속 사용할까요?',
      detail:
        `${displayPath}\n\n` +
        '보안 업데이트로 Memo 앱은 사용자가 직접 허용한 폴더에만 파일을 읽고 씁니다. ' +
        '이 폴더를 이전 버전에서 동기화 폴더(또는 미러 폴더)로 지정했다면 “허용”을 누르세요. ' +
        '지정한 적이 없는 폴더라면 “허용 안 함”을 누르세요.',
    })
    if (response === 0) {
      await store().add({ path: displayPath, realPath: realRoot, source: 'legacy' })
      return true
    }
    declinedLegacy.add(key)
    return false
  })().finally(() => pendingLegacy.delete(key))
  pendingLegacy.set(key, decision)
  return decision
}

/** Validate a renderer-supplied root against the allowlist; returns its realpath. */
async function authorizedRealRoot(root: unknown): Promise<string> {
  const input = validateRootInput(root)
  let real: string
  try {
    real = await realpathSafe(input)
  } catch {
    throw new SyncFolderAccessError('MISSING', '동기화 폴더를 찾을 수 없습니다.')
  }
  if (store().hasRealPath(real)) return real
  if (await confirmLegacyRoot(input, real)) return real
  throw new SyncFolderAccessError('NOT_ALLOWED', NOT_ALLOWED_MESSAGE)
}

/** Root + relative path → absolute target, with traversal and symlink-escape checks. */
async function resolveTarget(root: unknown, relPath: unknown): Promise<{ realRoot: string; target: string }> {
  const realRoot = await authorizedRealRoot(root)
  const target = resolveWithin(realRoot, relPath)
  await assertRealPathInside(realRoot, target, forbiddenRoots)
  return { realRoot, target }
}

function toBuffer(data: unknown): Buffer {
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  throw new SyncFolderAccessError('INVALID', '파일 데이터가 올바르지 않습니다.')
}

// ─── fs IPC ──────────────────────────────────────────

function registerFsHandlers(): void {
  handle('syncFolder:pickDirectory', async () => {
    const result = await showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '동기화 폴더 선택',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = path.resolve(result.filePaths[0])
    const real = await realpathSafe(dir)
    if (forbiddenRoots.some((f) => isSameOrInside(f, real))) {
      await showMessageBox({ type: 'warning', message: '앱 데이터 폴더는 동기화 폴더로 쓸 수 없습니다.', detail: dir })
      return null
    }
    await store().add({ path: dir, realPath: real, source: 'picker' })
    declinedLegacy.delete(pathKey(real))
    return { path: dir, name: path.basename(dir) || dir }
  })

  // "폴더 다시 연결": re-select the saved folder once in the native picker (pre-opened at
  // it). Only that same folder is accepted — a different one belongs to "폴더 변경".
  handle('syncFolder:authorizeRoot', async (root) => {
    const input = validateRootInput(root)
    const real = await realpathSafe(input).catch(() => null)
    if (!real) {
      await showMessageBox({
        type: 'warning',
        message: '동기화 폴더를 찾을 수 없습니다.',
        detail: `${input}\n\n폴더가 옮겨졌거나 삭제되었습니다. 설정 › 동기화 폴더에서 “폴더 변경”으로 다시 지정해 주세요.`,
      })
      return false
    }
    if (store().hasRealPath(real)) return true
    const result = await showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: input,
      title: '기존 동기화 폴더를 다시 선택하세요',
      message: '보안 업데이트로 폴더 접근을 한 번 다시 허용해야 합니다. 기존 폴더를 그대로 선택해 주세요.',
      buttonLabel: '이 폴더 허용',
    })
    if (result.canceled || result.filePaths.length === 0) return false
    const picked = path.resolve(result.filePaths[0])
    const pickedReal = await realpathSafe(picked).catch(() => null)
    if (!pickedReal || !samePath(pickedReal, real)) {
      await showMessageBox({
        type: 'warning',
        message: '선택한 폴더가 기존 동기화 폴더와 다릅니다.',
        detail: `기존 폴더: ${input}\n선택한 폴더: ${picked}\n\n다른 폴더를 쓰려면 설정 › 동기화 폴더에서 “폴더 변경”을 사용하세요.`,
      })
      return false
    }
    await store().add({ path: input, realPath: real, source: 'picker' })
    declinedLegacy.delete(pathKey(real))
    return true
  })

  handle('syncFolder:writeText', async (root, relPath, text) => {
    if (typeof text !== 'string') throw new SyncFolderAccessError('INVALID', '파일 데이터가 올바르지 않습니다.')
    const { target } = await resolveTarget(root, relPath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await writeFileAtomic(target, text)
  })

  handle('syncFolder:writeBinary', async (root, relPath, data) => {
    const buffer = toBuffer(data)
    const { target } = await resolveTarget(root, relPath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await writeFileAtomic(target, buffer)
  })

  handle('syncFolder:deleteFile', async (root, relPath) => {
    const { target } = await resolveTarget(root, relPath)
    await fs.rm(target, { force: true })
  })

  handle('syncFolder:exists', async (root, relPath) => {
    try {
      const { target } = await resolveTarget(root, relPath)
      await fs.lstat(target)
      return true
    } catch {
      return false
    }
  })

  handle('syncFolder:ensureDir', async (root, relPath) => {
    const { target } = await resolveTarget(root, relPath)
    await fs.mkdir(target, { recursive: true })
  })

  handle('syncFolder:removeDir', async (root, relPath) => {
    try {
      const { target } = await resolveTarget(root, relPath)
      // Non-recursive rmdir: removes an empty directory only. ENOTEMPTY (still has files)
      // and ENOENT (already gone) are expected and ignored — never delete user files here.
      await fs.rmdir(target)
    } catch {
      /* non-empty, missing or not allowed → leave it in place */
    }
  })

  handle('syncFolder:dirExists', async (root) => {
    try {
      const real = await authorizedRealRoot(root)
      return (await fs.stat(real)).isDirectory()
    } catch {
      return false
    }
  })

  handle('syncFolder:listPaths', async (root) => {
    let realRoot: string
    try {
      realRoot = await authorizedRealRoot(root)
    } catch {
      return []
    }
    const out: string[] = []
    async function walk(dir: string, prefix: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue // never follow links out of the root
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel)
        else if (entry.isFile()) out.push(rel)
      }
    }
    try {
      await walk(realRoot, '')
    } catch {
      /* root vanished mid-walk → partial/empty list */
    }
    return out
  })
}

// ─── File watching (Phase 2 M2 · reverse sync) ───────

let watcher: FSWatcher | null = null
let watchGeneration = 0

function stopWatcher(): void {
  watchGeneration++
  if (watcher) {
    void watcher.close()
    watcher = null
  }
}

function toRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/')
}

/** Only deliver file contents to the main window while it still shows the app origin. */
function canReceive(sender: WebContents): boolean {
  if (sender.isDestroyed() || !mainWindow || mainWindow.isDestroyed() || sender !== mainWindow.webContents) return false
  try {
    return ALLOWED_ORIGINS.includes(sender.mainFrame.origin)
  } catch {
    return false
  }
}

async function emitFileEvent(
  sender: WebContents,
  type: 'add' | 'change' | 'unlink',
  realRoot: string,
  abs: string,
): Promise<void> {
  const rel = toRel(realRoot, abs)
  if (!shouldWatchRelPath(rel) || !canReceive(sender)) return
  if (type === 'unlink') {
    sender.send('syncFolder:fileEvent', { type, relPath: rel })
    return
  }
  try {
    // Regular files only, and only if they really live inside the root (no symlinks).
    if (!(await fs.lstat(abs)).isFile()) return
    await assertRealPathInside(realRoot, abs, forbiddenRoots)
    const content = await fs.readFile(abs, 'utf-8')
    if (canReceive(sender)) sender.send('syncFolder:fileEvent', { type, relPath: rel, content })
  } catch {
    /* file vanished between event and read, or refused */
  }
}

async function startWatcher(sender: WebContents, root: unknown): Promise<void> {
  stopWatcher()
  const generation = watchGeneration
  let realRoot: string
  try {
    realRoot = await authorizedRealRoot(root)
  } catch (err) {
    console.warn('[syncFolder] watch refused:', (err as Error).message)
    return
  }
  // A newer start/stop arrived while we were waiting (e.g. on the legacy confirm).
  if (generation !== watchGeneration) return
  // ignoreInitial: the app owns the initial state; awaitWriteFinish debounces
  // partial/atomic writes so we read a settled file (§4.6). Links are not followed.
  const w = chokidar.watch(realRoot, {
    ignoreInitial: true,
    followSymlinks: false,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    ignored: (p: string) => {
      const rel = path.relative(realRoot, p)
      return rel !== '' && rel.split(path.sep).some((part) => part.startsWith('.'))
    },
  })
  w.on('add', (p) => void emitFileEvent(sender, 'add', realRoot, p))
    .on('change', (p) => void emitFileEvent(sender, 'change', realRoot, p))
    .on('unlink', (p) => void emitFileEvent(sender, 'unlink', realRoot, p))
  watcher = w
}

function registerWatchHandlers(): void {
  ipcMain.on('syncFolder:startWatch', (event, root: unknown) => {
    if (!isTrusted(event)) return
    void startWatcher(event.sender, root)
  })

  ipcMain.on('syncFolder:stopWatch', (event) => {
    if (!isTrusted(event)) return
    stopWatcher()
  })
}

// ─── App lifecycle ───────────────────────────────────

async function start(): Promise<void> {
  const userData = app.getPath('userData')
  forbiddenRoots = [await realpathSafe(userData).catch(() => path.resolve(userData))]
  // Before the first window: on a fresh install the profile has no web storage yet,
  // which is how the store tells an upgrade (legacy roots possible) from a new install.
  rootStore = await RootStore.load(path.join(userData, ROOT_STORE_FILE), {
    hasPriorWebData: () => hasPriorWebData(userData),
  })

  registerFsHandlers()
  registerWatchHandlers()
  createWindow()

  // electron-updater is not wired up yet (private repo + no latest.yml in the release
  // workflow — see docs/ELECTRON_BUILD.md); the check just fails quietly until it is.
  if (isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => console.error('Update check failed:', err))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

// Two instances writing the same sync folder would race each other's atomic writes and
// double every watcher event — keep one; a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  app.whenReady().then(start).catch((err) => {
    console.error('Startup failed:', err)
    app.quit()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
