// Renderer-visible surface of the Electron preload bridge (contextBridge).
// Present only when running inside the packaged desktop app; `undefined` on the web.
// The main-process side lives in electron/main.ts; the exposure in electron/preload.ts.

interface ElectronSyncBridge {
  readonly isElectron: true
  readonly appVersion: string
  /** Native folder picker. Returns the chosen absolute path + basename, or null if cancelled. */
  pickDirectory(): Promise<{ path: string; name: string } | null>
  writeText(root: string, relPath: string, text: string): Promise<void>
  writeBinary(root: string, relPath: string, data: ArrayBuffer): Promise<void>
  deleteFile(root: string, relPath: string): Promise<void>
  exists(root: string, relPath: string): Promise<boolean>
  listPaths(root: string): Promise<string[]>
  /** Whether the stored root folder still exists (it may have been moved/deleted). */
  dirExists(root: string): Promise<boolean>

  // ─── Phase 2 M2: file watching (reverse sync) ───
  /** Begin watching the root folder for external .md edits. */
  startWatching(root: string): void
  stopWatching(): void
  /** Subscribe to watcher events. Returns an unsubscribe function. */
  onFileEvent(
    cb: (event: { type: 'add' | 'change' | 'unlink'; relPath: string; content?: string }) => void,
  ): () => void
}

interface Window {
  electronBridge?: ElectronSyncBridge
}
