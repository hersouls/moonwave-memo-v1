// Renderer-visible surface of the Electron preload bridge (contextBridge).
// Present only when running inside the packaged desktop app; `undefined` on the web.
// The main-process side lives in electron/main.ts; the exposure in electron/preload.ts.

interface ElectronSyncBridge {
  readonly isElectron: true
  /** App version from the main process (app.getVersion()); empty in older desktop builds. */
  readonly appVersion: string
  /** Native folder picker. Returns the chosen absolute path + basename, or null if cancelled. */
  pickDirectory(): Promise<{ path: string; name: string } | null>
  /**
   * Re-authorize a previously saved root: main opens the native picker at that folder and
   * accepts only the same folder. Resolves true when the root is (now) on main's allowlist.
   * Absent in desktop builds from before the root allowlist.
   */
  authorizeRoot?(root: string): Promise<boolean>
  writeText(root: string, relPath: string, text: string): Promise<void>
  writeBinary(root: string, relPath: string, data: ArrayBuffer): Promise<void>
  deleteFile(root: string, relPath: string): Promise<void>
  exists(root: string, relPath: string): Promise<boolean>
  /** Create a directory (recursive) under the root — materializes an empty memo folder. */
  ensureDir(root: string, relPath: string): Promise<void>
  /** Remove a directory only if empty (non-recursive). Missing/non-empty is not an error. */
  removeDir(root: string, relPath: string): Promise<void>
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
