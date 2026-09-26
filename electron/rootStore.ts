/**
 * Allowlist of sync-folder roots — the main process's source of truth for which folders
 * the renderer may touch. A root only gets in through a native dialog shown by main:
 * the folder picker, or (once, for roots saved by a pre-allowlist version) a native
 * confirm. Persisted as JSON in userData, written atomically. No `electron` import.
 *
 * Legacy migration: versions before this one kept the chosen folder only in the web
 * app's storage, so on the first run after the upgrade main knows none of them. If the
 * profile already has web storage (= this is an upgrade, not a fresh install), a
 * LEGACY_WINDOW_DAYS window opens during which a root the renderer asks for that isn't
 * on the list may be approved with one native confirm (main.ts confirmLegacyRoot).
 * Fresh installs and unreadable stores never get that window — only the picker.
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { writeFileAtomic } from './atomicWrite'
import { samePath } from './security'

export const ROOT_STORE_FILE = 'sync-roots.json'
export const LEGACY_WINDOW_DAYS = 30

export interface RootEntry {
  /** Path as the user picked it — what the renderer stores and sends back. */
  path: string
  /** realpath at authorization time; requests are matched against this. */
  realPath: string
  source: 'picker' | 'legacy'
  addedAt: string
}

interface RootStoreData {
  version: 1
  roots: RootEntry[]
  /** ISO time until which legacy roots may be confirmed; null = never. */
  legacyUntil: string | null
}

function isRootEntry(v: unknown): v is RootEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    typeof e.path === 'string' &&
    typeof e.realPath === 'string' &&
    path.isAbsolute(e.realPath) &&
    (e.source === 'picker' || e.source === 'legacy') &&
    typeof e.addedAt === 'string'
  )
}

/** Tolerant parse: drops malformed entries; throws only if the document itself is unusable. */
export function parseRootStore(raw: string): RootStoreData {
  const doc = JSON.parse(raw) as Record<string, unknown>
  if (!doc || typeof doc !== 'object' || doc.version !== 1 || !Array.isArray(doc.roots)) {
    throw new Error('unrecognized root store format')
  }
  const legacyUntil = typeof doc.legacyUntil === 'string' && !Number.isNaN(Date.parse(doc.legacyUntil))
    ? doc.legacyUntil
    : null
  return { version: 1, roots: doc.roots.filter(isRootEntry), legacyUntil }
}

/** True when the profile already holds web storage — i.e. the app ran before this version. */
export async function hasPriorWebData(userDataDir: string): Promise<boolean> {
  for (const dir of ['IndexedDB', 'Local Storage']) {
    try {
      if ((await fs.readdir(path.join(userDataDir, dir))).length > 0) return true
    } catch {
      /* missing → keep looking */
    }
  }
  return false
}

export interface LoadOptions {
  now?: Date
  /** Consulted only when the store file doesn't exist yet (first run of this version). */
  hasPriorWebData: () => Promise<boolean>
}

export class RootStore {
  private data: RootStoreData
  private readonly file: string
  private saving: Promise<void> = Promise.resolve()

  private constructor(file: string, data: RootStoreData) {
    this.file = file
    this.data = data
  }

  static async load(file: string, opts: LoadOptions): Promise<RootStore> {
    const now = opts.now ?? new Date()
    let raw: string | null = null
    try {
      raw = await fs.readFile(file, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Unreadable (permissions…): fail closed for this session, don't overwrite it.
        console.error('[rootStore] cannot read allowlist:', err)
        return new RootStore(file, { version: 1, roots: [], legacyUntil: null })
      }
    }

    if (raw != null) {
      try {
        return new RootStore(file, parseRootStore(raw))
      } catch (err) {
        // Corrupt: keep a copy for diagnosis, start over fail-closed (re-pick needed).
        console.error('[rootStore] corrupt allowlist, starting empty:', err)
        await fs.rename(file, `${file}.corrupt`).catch(() => {})
        const store = new RootStore(file, { version: 1, roots: [], legacyUntil: null })
        await store.save()
        return store
      }
    }

    const upgraded = await opts.hasPriorWebData().catch(() => false)
    const legacyUntil = upgraded
      ? new Date(now.getTime() + LEGACY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null
    const store = new RootStore(file, { version: 1, roots: [], legacyUntil })
    await store.save()
    return store
  }

  entries(): readonly RootEntry[] {
    return this.data.roots
  }

  /** Whether a realpath-normalized root is on the list. */
  hasRealPath(realPath: string): boolean {
    return this.data.roots.some((r) => samePath(r.realPath, realPath))
  }

  isLegacyWindowOpen(now: Date = new Date()): boolean {
    const until = this.data.legacyUntil
    return until != null && now.getTime() < Date.parse(until)
  }

  /** Record an authorized root (deduplicated by realpath) and persist. */
  async add(entry: Omit<RootEntry, 'addedAt'>, now: Date = new Date()): Promise<void> {
    const rest = this.data.roots.filter((r) => !samePath(r.realPath, entry.realPath))
    this.data = { ...this.data, roots: [...rest, { ...entry, addedAt: now.toISOString() }] }
    await this.save()
  }

  /** Serialized, atomic write; a failed save is logged (the in-memory list still applies). */
  private save(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2)
    this.saving = this.saving
      .then(async () => {
        await fs.mkdir(path.dirname(this.file), { recursive: true })
        await writeFileAtomic(this.file, snapshot)
      })
      .catch((err) => console.error('[rootStore] failed to save allowlist:', err))
    return this.saving
  }
}
