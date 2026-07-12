/**
 * Platform-agnostic write target for the sync folder — the durable Phase 1
 * deliverable (§Phase 1 산출물 재정의). Phase 1 ships the File System Access API
 * backend; Phase 2 (Electron/Node fs) and Phase 3 (Capacitor/SAF) swap the backend
 * behind this same interface, so the serializer, orchestration, deletion mapping and
 * UI built on top do not change.
 *
 * Paths are always relative to the chosen root, use `/` separators, and may be nested
 * one directory deep (memo folders → subdirectories). Implementations create
 * intermediate directories on write.
 */
export interface FileSyncTarget {
  /** A stable identifier for the target (used to scope the Web Locks single-writer). */
  readonly key: string
  writeText(path: string, text: string): Promise<void>
  writeBinary(path: string, blob: Blob): Promise<void>
  /** Delete a file. A missing file is not an error. */
  deleteFile(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  /** All file paths under the root (recursive), relative to the root. */
  listPaths(): Promise<string[]>
}

/** Convert a base64 data URL (as stored in Dexie memoImages) to a Blob for binary write. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',', 2)
  const mimeMatch = /^data:([^;,]+)/.exec(header)
  const mime = mimeMatch?.[1] || 'application/octet-stream'
  const isBase64 = /;base64/i.test(header)
  if (!isBase64) {
    return new Blob([decodeURIComponent(data)], { type: mime })
  }
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
