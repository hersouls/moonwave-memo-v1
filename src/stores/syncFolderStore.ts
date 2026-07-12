import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Device-local state for the sync-folder feature (§4.8, §6).
 *
 * CRITICAL: this is a SEPARATE store with its own localStorage key — it must never
 * be added to settingsStore, because settingsStore is cloud-synced (settingsSync)
 * and folder paths / enable flags are inherently per-device. Syncing them would let
 * one device's `D:\Memo` path silently overwrite another's.
 *
 * The directory handle itself is not serializable to localStorage; it lives in
 * IndexedDB (syncFolderKV) and is managed by syncFolderService. Only the plain
 * config (enabled, format, display name) is persisted here.
 */

export type SyncFolderFormat = 'md' | 'html' | 'both'
export type SyncFolderStatus = 'idle' | 'writing' | 'queued' | 'error' | 'needs-permission'

interface SyncFolderState {
  /** Whether folder writing is active. Persisted. */
  enabled: boolean
  /** File format(s) to write. Persisted. Phase 1 only implements 'md'. */
  format: SyncFolderFormat
  /** Display name of the chosen root folder. Persisted for UI continuity. */
  folderName: string | null

  /** Runtime status (not persisted). */
  status: SyncFolderStatus
  lastWrittenAt: string | null
  fileCount: number
  error: string | null

  setEnabled: (enabled: boolean) => void
  setFormat: (format: SyncFolderFormat) => void
  setFolderName: (name: string | null) => void
  setStatus: (status: SyncFolderStatus, error?: string | null) => void
  setLastWritten: (at: string) => void
  setFileCount: (count: number) => void
  reset: () => void
}

export const useSyncFolderStore = create<SyncFolderState>()(
  persist(
    (set) => ({
      enabled: false,
      format: 'md',
      folderName: null,
      status: 'idle',
      lastWrittenAt: null,
      fileCount: 0,
      error: null,

      setEnabled: (enabled) => set({ enabled }),
      setFormat: (format) => set({ format }),
      setFolderName: (folderName) => set({ folderName }),
      setStatus: (status, error = null) => set({ status, error }),
      setLastWritten: (lastWrittenAt) => set({ lastWrittenAt }),
      setFileCount: (fileCount) => set({ fileCount }),
      reset: () =>
        set({
          enabled: false,
          folderName: null,
          status: 'idle',
          lastWrittenAt: null,
          fileCount: 0,
          error: null,
        }),
    }),
    {
      name: 'memo-sync-folder',
      // Persist only the durable config, not transient runtime status.
      partialize: (state) => ({
        enabled: state.enabled,
        format: state.format,
        folderName: state.folderName,
      }),
    },
  ),
)
