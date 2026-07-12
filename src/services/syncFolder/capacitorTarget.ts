/**
 * Capacitor (Android) implementation of FileSyncTarget (Phase 3, Milestone 1).
 *
 * Writes memo files to the phone's public Documents folder via the official
 * @capacitor/filesystem plugin — the roadmap's RECOMMENDED mobile path: the app owns
 * a local folder and a background sync agent (Synology Drive / FolderSync / Syncthing)
 * mirrors it to a NAS. Because Documents is public, those agents can see the files.
 *
 * Mobile is one-way (app → folder): there is no file watcher here (OS constraints —
 * §Phase 3 범위 제한). Picking an arbitrary SAF folder (DS File etc.) is a separate,
 * device-verified spike (docs/CAPACITOR_BUILD.md); it is intentionally NOT this backend.
 */
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import type { FileSyncTarget } from './FileSyncTarget'

const DIR = Directory.Documents

/** Default base subfolder under Documents. */
export const DEFAULT_CAPACITOR_SUBDIR = 'MoonwaveMemo'

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export class CapacitorFileSyncTarget implements FileSyncTarget {
  readonly key: string
  private base: string

  constructor(subdir: string) {
    this.base = subdir.replace(/\/+$/, '')
    this.key = `capacitor:${this.base}`
  }

  private full(path: string): string {
    return path ? `${this.base}/${path}` : this.base
  }

  async writeText(path: string, text: string): Promise<void> {
    await Filesystem.writeFile({
      path: this.full(path),
      data: text,
      directory: DIR,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  }

  async writeBinary(path: string, blob: Blob): Promise<void> {
    await Filesystem.writeFile({
      path: this.full(path),
      data: await blobToBase64(blob),
      directory: DIR,
      recursive: true,
    })
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: this.full(path), directory: DIR })
    } catch {
      /* not found → already gone */
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path: this.full(path), directory: DIR })
      return true
    } catch {
      return false
    }
  }

  async listPaths(): Promise<string[]> {
    const out: string[] = []
    const walk = async (rel: string): Promise<void> => {
      let res
      try {
        res = await Filesystem.readdir({ path: this.full(rel), directory: DIR })
      } catch {
        return
      }
      for (const f of res.files) {
        const childRel = rel ? `${rel}/${f.name}` : f.name
        if (f.type === 'directory') await walk(childRel)
        else out.push(childRel)
      }
    }
    await walk('')
    return out
  }
}
