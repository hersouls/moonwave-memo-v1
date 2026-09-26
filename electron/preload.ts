/**
 * Electron preload — exposes a minimal, typed filesystem bridge to the renderer via
 * contextBridge. The renderer sees only these functions on `window.electronBridge`; it
 * never touches Node or ipcRenderer directly. Shape must match src/types/electron-bridge.d.ts.
 *
 * Runs SANDBOXED (webPreferences.sandbox): it may only require('electron') — the esbuild
 * bundle is checked for that in scripts/build-electron.mjs. Data from main comes in via
 * `additionalArguments` on process.argv.
 */
import { contextBridge, ipcRenderer } from 'electron'

// The preload runs in the page's isolated world, so `location` is the page's.
declare const location: { readonly origin: string }

function argValue(prefix: string): string {
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

type FileEvent = { type: 'add' | 'change' | 'unlink'; relPath: string; content?: string }

const allowedOrigins = argValue('--memo-origins=').split(',').filter(Boolean)

// Defense in depth: main already rejects IPC from anything but the main frame of the
// main window on the app origin; don't even expose the bridge anywhere else.
if (allowedOrigins.includes(location.origin)) {
  contextBridge.exposeInMainWorld('electronBridge', {
    isElectron: true,
    // Real version from main (app.getVersion()); npm_package_version is empty in an installed app.
    appVersion: argValue('--memo-version='),
    pickDirectory: () => ipcRenderer.invoke('syncFolder:pickDirectory'),
    authorizeRoot: (root: string) => ipcRenderer.invoke('syncFolder:authorizeRoot', root),
    writeText: (root: string, relPath: string, text: string) =>
      ipcRenderer.invoke('syncFolder:writeText', root, relPath, text),
    writeBinary: (root: string, relPath: string, data: ArrayBuffer) =>
      ipcRenderer.invoke('syncFolder:writeBinary', root, relPath, data),
    deleteFile: (root: string, relPath: string) =>
      ipcRenderer.invoke('syncFolder:deleteFile', root, relPath),
    exists: (root: string, relPath: string) =>
      ipcRenderer.invoke('syncFolder:exists', root, relPath),
    ensureDir: (root: string, relPath: string) =>
      ipcRenderer.invoke('syncFolder:ensureDir', root, relPath),
    removeDir: (root: string, relPath: string) =>
      ipcRenderer.invoke('syncFolder:removeDir', root, relPath),
    listPaths: (root: string) => ipcRenderer.invoke('syncFolder:listPaths', root),
    dirExists: (root: string) => ipcRenderer.invoke('syncFolder:dirExists', root),

    // Phase 2 M2: file watching
    startWatching: (root: string) => ipcRenderer.send('syncFolder:startWatch', root),
    stopWatching: () => ipcRenderer.send('syncFolder:stopWatch'),
    onFileEvent: (cb: (event: FileEvent) => void) => {
      const listener = (_e: unknown, payload: FileEvent) => cb(payload)
      ipcRenderer.on('syncFolder:fileEvent', listener)
      return () => ipcRenderer.removeListener('syncFolder:fileEvent', listener)
    },
  })
}
