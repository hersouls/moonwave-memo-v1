import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { LEGACY_WINDOW_DAYS, RootStore, hasPriorWebData, parseRootStore } from '../rootStore'

const DAY = 24 * 60 * 60 * 1000

describe('RootStore', () => {
  let dir: string
  let file: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'memo-roots-'))
    file = path.join(dir, 'sync-roots.json')
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('fresh install: empty list, no legacy window', async () => {
    const store = await RootStore.load(file, { hasPriorWebData: async () => false })
    expect(store.entries()).toEqual([])
    expect(store.isLegacyWindowOpen()).toBe(false)
    const saved = JSON.parse(await fs.readFile(file, 'utf-8'))
    expect(saved).toEqual({ version: 1, roots: [], legacyUntil: null })
  })

  it('upgrade: opens a legacy window once, which then expires', async () => {
    const now = new Date('2026-09-26T00:00:00Z')
    const store = await RootStore.load(file, { now, hasPriorWebData: async () => true })
    expect(store.isLegacyWindowOpen(now)).toBe(true)
    expect(store.isLegacyWindowOpen(new Date(now.getTime() + (LEGACY_WINDOW_DAYS - 1) * DAY))).toBe(true)
    expect(store.isLegacyWindowOpen(new Date(now.getTime() + (LEGACY_WINDOW_DAYS + 1) * DAY))).toBe(false)

    // The window is fixed at first run — a later load doesn't reopen or extend it.
    let asked = false
    const later = await RootStore.load(file, {
      now: new Date(now.getTime() + 10 * DAY),
      hasPriorWebData: async () => {
        asked = true
        return true
      },
    })
    expect(asked).toBe(false)
    expect(later.isLegacyWindowOpen(new Date(now.getTime() + (LEGACY_WINDOW_DAYS + 1) * DAY))).toBe(false)
  })

  it('persists added roots, deduplicated by realpath', async () => {
    const store = await RootStore.load(file, { hasPriorWebData: async () => false })
    await store.add({ path: '/Users/me/Memo', realPath: '/Users/me/Memo', source: 'picker' })
    await store.add({ path: '/Volumes/NAS/memo', realPath: '/Volumes/NAS/memo', source: 'legacy' })
    await store.add({ path: '/Users/me/memo-link', realPath: '/Users/me/Memo', source: 'picker' })
    expect(store.entries()).toHaveLength(2)
    expect(store.hasRealPath('/Users/me/Memo')).toBe(true)
    expect(store.hasRealPath('/Users/me/Memo/sub')).toBe(false)
    expect(store.hasRealPath('/Users/me')).toBe(false)

    const reloaded = await RootStore.load(file, { hasPriorWebData: async () => false })
    expect(reloaded.hasRealPath('/Volumes/NAS/memo')).toBe(true)
    expect(reloaded.entries().map((e) => e.path).sort()).toEqual(['/Users/me/memo-link', '/Volumes/NAS/memo'])
  })

  it('corrupt file: fails closed (empty, no legacy window) and keeps a copy', async () => {
    await fs.writeFile(file, '{ not json')
    const store = await RootStore.load(file, { hasPriorWebData: async () => true })
    expect(store.entries()).toEqual([])
    expect(store.isLegacyWindowOpen()).toBe(false)
    expect(await fs.readFile(`${file}.corrupt`, 'utf-8')).toBe('{ not json')
  })
})

describe('parseRootStore', () => {
  it('drops malformed entries', () => {
    const parsed = parseRootStore(
      JSON.stringify({
        version: 1,
        legacyUntil: 'not a date',
        roots: [
          { path: '/ok', realPath: '/ok', source: 'picker', addedAt: 'x' },
          { path: '/rel', realPath: 'relative', source: 'picker', addedAt: 'x' },
          { path: '/bad', realPath: '/bad', source: 'renderer', addedAt: 'x' },
          'nope',
        ],
      }),
    )
    expect(parsed.roots.map((r) => r.path)).toEqual(['/ok'])
    expect(parsed.legacyUntil).toBeNull()
  })

  it('throws on an unknown document', () => {
    expect(() => parseRootStore('{"version":2,"roots":[]}')).toThrow()
    expect(() => parseRootStore('[]')).toThrow()
  })
})

describe('hasPriorWebData', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'memo-ud-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('false for a fresh profile', async () => {
    await fs.mkdir(path.join(dir, 'GPUCache'))
    await fs.mkdir(path.join(dir, 'IndexedDB')) // empty
    expect(await hasPriorWebData(dir)).toBe(false)
  })

  it('true once the site stored IndexedDB or localStorage data', async () => {
    await fs.mkdir(path.join(dir, 'IndexedDB', 'https_memo.moonwave.kr_0.indexeddb.leveldb'), { recursive: true })
    expect(await hasPriorWebData(dir)).toBe(true)
  })

  it('true for localStorage only', async () => {
    await fs.mkdir(path.join(dir, 'Local Storage', 'leveldb'), { recursive: true })
    expect(await hasPriorWebData(dir)).toBe(true)
  })
})
