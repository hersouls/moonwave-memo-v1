/**
 * Electron/Node fs implementation of FileSyncTarget (Phase 2 backend).
 *
 * Delegates all file I/O to the main process over the preload IPC bridge. This is the
 * backend swap the Phase 1 FileSyncTarget abstraction was designed for — the
 * serializer, deletion mapping, debounce and UI are unchanged; only the bytes-to-disk
 * layer differs. Native fs means no permission re-prompts and access to NAS paths.
 */
import type { FileSyncTarget } from './FileSyncTarget'

type Bridge = NonNullable<Window['electronBridge']>

export class IpcFileSyncTarget implements FileSyncTarget {
  readonly key: string
  private root: string
  private bridge: Bridge

  constructor(root: string, bridge: Bridge) {
    this.root = root
    this.bridge = bridge
    this.key = `ipc:${root}`
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.bridge.writeText(this.root, path, text)
  }

  async writeBinary(path: string, blob: Blob): Promise<void> {
    await this.bridge.writeBinary(this.root, path, await blob.arrayBuffer())
  }

  async deleteFile(path: string): Promise<void> {
    await this.bridge.deleteFile(this.root, path)
  }

  async exists(path: string): Promise<boolean> {
    return this.bridge.exists(this.root, path)
  }

  async listPaths(): Promise<string[]> {
    return this.bridge.listPaths(this.root)
  }
}
