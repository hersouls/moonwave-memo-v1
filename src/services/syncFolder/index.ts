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
  notifyFolderCreated,
  notifyFolderRenamed,
  notifyFolderDeleted,
  exportAllMemosToFolder,
  setSyncFolderFormat,
  importHtmlFiles,
  addMirrorFolder,
  removeMirrorFolder,
  flushPendingFileOps,
  type ExportProgress,
  type PickFolderResult,
  type AddMirrorResult,
} from './syncFolderService'

export { isElectron, isCapacitor } from './platform'
export type { FileSyncTarget } from './FileSyncTarget'
