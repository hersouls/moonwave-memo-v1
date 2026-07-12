/**
 * Sync-folder feature (Phase 1) — public surface.
 *
 * memoStore calls notifyMemoSaved/notifyMemoDeleted; the settings UI and app
 * bootstrap use the lifecycle + export functions. The pure serialization modules
 * (frontmatter/filename/serializer/hash) are internal but exported for unit tests.
 */
export {
  isSyncFolderSupported,
  initSyncFolder,
  pickSyncFolder,
  reconnectSyncFolder,
  disableSyncFolder,
  notifyMemoSaved,
  notifyMemoDeleted,
  exportAllMemosToFolder,
  addMirrorFolder,
  removeMirrorFolder,
  flushPendingFileOps,
  type ExportProgress,
} from './syncFolderService'

export { isElectron } from './platform'
export type { FileSyncTarget } from './FileSyncTarget'
