/**
 * File System Access API implementation of FileSyncTarget (Phase 1 backend).
 *
 * Wraps a FileSystemDirectoryHandle obtained from window.showDirectoryPicker().
 * Chromium-only; callers gate on isSyncFolderSupported() before use.
 */
import type { FileSyncTarget } from './FileSyncTarget'

function splitPath(path: string): { dirs: string[]; name: string } {
  const parts = path.split('/').filter(Boolean)
  const name = parts.pop() ?? ''
  return { dirs: parts, name }
}

export class FsaFileSyncTarget implements FileSyncTarget {
  readonly key: string
  private root: FileSystemDirectoryHandle

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root
    this.key = `fsa:${root.name}`
  }

  private async dirHandle(dirs: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let handle = this.root
    for (const dir of dirs) {
      try {
        handle = await handle.getDirectoryHandle(dir, { create })
      } catch {
        return null
      }
    }
    return handle
  }

  private async writeBlob(path: string, contents: Blob | string): Promise<void> {
    const { dirs, name } = splitPath(path)
    const dir = await this.dirHandle(dirs, true)
    if (!dir) throw new Error(`디렉터리를 만들 수 없습니다: ${dirs.join('/')}`)
    const fileHandle = await dir.getFileHandle(name, { create: true })
    const writable = await fileHandle.createWritable()
    try {
      await writable.write(contents)
    } finally {
      await writable.close()
    }
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeBlob(path, new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  }

  async writeBinary(path: string, blob: Blob): Promise<void> {
    await this.writeBlob(path, blob)
  }

  async deleteFile(path: string): Promise<void> {
    const { dirs, name } = splitPath(path)
    const dir = await this.dirHandle(dirs, false)
    if (!dir) return
    try {
      await dir.removeEntry(name)
    } catch (err) {
      // NotFoundError → already gone; anything else is a real failure.
      if ((err as DOMException)?.name !== 'NotFoundError') throw err
    }
  }

  async exists(path: string): Promise<boolean> {
    const { dirs, name } = splitPath(path)
    const dir = await this.dirHandle(dirs, false)
    if (!dir) return false
    try {
      await dir.getFileHandle(name, { create: false })
      return true
    } catch {
      return false
    }
  }

  async ensureDir(path: string): Promise<void> {
    const dirs = path.split('/').filter(Boolean)
    if (!dirs.length) return
    const handle = await this.dirHandle(dirs, true)
    if (!handle) throw new Error(`디렉터리를 만들 수 없습니다: ${dirs.join('/')}`)
  }

  async removeDir(path: string): Promise<void> {
    const { dirs, name } = splitPath(path)
    if (!name) return
    const parent = await this.dirHandle(dirs, false)
    if (!parent) return // already gone
    try {
      // recursive:false → throws if the directory still contains entries, so we never
      // delete user files; a still-populated folder is intentionally left in place.
      await parent.removeEntry(name, { recursive: false })
    } catch (err) {
      const n = (err as DOMException)?.name
      if (n !== 'NotFoundError' && n !== 'InvalidModificationError') throw err
    }
  }

  async listPaths(): Promise<string[]> {
    const out: string[] = []
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
      for await (const entry of dir.values()) {
        const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.kind === 'file') {
          out.push(entryPath)
        } else {
          await walk(entry as FileSystemDirectoryHandle, entryPath)
        }
      }
    }
    await walk(this.root, '')
    return out
  }
}
