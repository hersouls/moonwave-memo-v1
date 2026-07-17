/**
 * Electron preload — exposes a minimal, typed filesystem bridge to the renderer via
 * contextBridge (contextIsolation is on, nodeIntegration off). The renderer sees only
 * these functions on `window.electronBridge`; it never touches Node or ipcRenderer
 * directly. Shape must match src/types/electron-bridge.d.ts.
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronBridge', {
  isElectron: true,
  appVersion: process.env.npm_package_version ?? '',
  pickDirectory: () => ipcRenderer.invoke('syncFolder:pickDirectory'),
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
  onFileEvent: (cb: (event: { type: 'add' | 'change' | 'unlink'; relPath: string; content?: string }) => void) => {
    const listener = (_e: unknown, payload: { type: 'add' | 'change' | 'unlink'; relPath: string; content?: string }) => cb(payload)
    ipcRenderer.on('syncFolder:fileEvent', listener)
    return () => ipcRenderer.removeListener('syncFolder:fileEvent', listener)
  },
})
