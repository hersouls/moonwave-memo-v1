/**
 * Crash-safe file write: write a temp file in the same directory, fsync it, then rename
 * it over the target. A crash or power loss mid-write leaves either the old file or the
 * new one — never a truncated memo. No `electron` import (unit-tested with vitest).
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { randomBytes } from 'node:crypto'

/** Windows reports these while another process (AV scanner, indexer, editor) holds the target. */
const RETRYABLE_RENAME = new Set(['EPERM', 'EACCES', 'EBUSY'])

export interface AtomicWriteOptions {
  platform?: NodeJS.Platform
  /** Rename attempts on Windows before falling back to an in-place copy. */
  renameAttempts?: number
  retryDelayMs?: number
}

/** Temp files are dot-prefixed so the watcher and the importer ignore them. */
export const TEMP_PREFIX = '.memo-tmp-'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function errCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException | null)?.code
}

async function renameWithRetry(tmp: string, target: string, opts: Required<AtomicWriteOptions>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(tmp, target)
      return
    } catch (err) {
      const retryable = opts.platform === 'win32' && RETRYABLE_RENAME.has(errCode(err) ?? '')
      if (!retryable) throw err
      if (attempt < opts.renameAttempts) {
        await sleep(opts.retryDelayMs * 2 ** (attempt - 1))
        continue
      }
      // Still locked: overwrite in place so the memo is saved at all (the pre-atomic
      // behaviour) rather than failing the write outright.
      await fs.copyFile(tmp, target)
      await fs.rm(tmp, { force: true })
      return
    }
  }
}

/** Make the rename itself durable (POSIX only; Windows can't open a directory for sync). */
async function fsyncDir(dir: string): Promise<void> {
  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(dir, 'r')
    await handle.sync()
  } catch {
    /* unsupported on this filesystem — best effort */
  } finally {
    await handle?.close().catch(() => {})
  }
}

export async function writeFileAtomic(
  target: string,
  data: string | Uint8Array,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const opts: Required<AtomicWriteOptions> = {
    platform: options.platform ?? process.platform,
    renameAttempts: options.renameAttempts ?? 5,
    retryDelayMs: options.retryDelayMs ?? 25,
  }
  const dir = path.dirname(target)
  const tmp = path.join(dir, `${TEMP_PREFIX}${randomBytes(6).toString('hex')}`)
  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(tmp, 'wx')
    if (opts.platform !== 'win32') {
      // Keep the permissions of the file being replaced.
      const prev = await fs.stat(target).catch(() => null)
      if (prev?.isFile()) await handle.chmod(prev.mode & 0o7777).catch(() => {})
    }
    await handle.writeFile(data)
    // Some network filesystems (SMB/NFS mounts) reject fsync; the rename is still atomic.
    await handle.sync().catch(() => {})
    await handle.close()
    handle = null
    await renameWithRetry(tmp, target, opts)
  } catch (err) {
    await handle?.close().catch(() => {})
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw err
  }
  if (opts.platform !== 'win32') await fsyncDir(dir)
}
