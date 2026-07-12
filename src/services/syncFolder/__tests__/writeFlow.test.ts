import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { Memo } from '@/lib/types'
import type { FileSyncTarget } from '../FileSyncTarget'
import { serializeMemo, deserializeMemo, type ImageResolver } from '../serializer'
import { contentHash } from '../hash'

/**
 * End-to-end verification of the write contract (serializer → FileSyncTarget) using
 * an in-memory target that implements the same interface the FSA/Electron/Capacitor
 * backends do. The live FSA flow needs a user gesture (showDirectoryPicker) and can't
 * run headless, but everything between "a memo changed" and "bytes handed to a target"
 * is exercised here.
 */
class MemoryFileSyncTarget implements FileSyncTarget {
  readonly key = 'memory'
  files = new Map<string, string>()
  binaries = new Map<string, Blob>()

  async writeText(path: string, text: string): Promise<void> { this.files.set(path, text) }
  async writeBinary(path: string, blob: Blob): Promise<void> { this.binaries.set(path, blob) }
  async deleteFile(path: string): Promise<void> { this.files.delete(path); this.binaries.delete(path) }
  async exists(path: string): Promise<boolean> { return this.files.has(path) || this.binaries.has(path) }
  async listPaths(): Promise<string[]> { return [...this.files.keys(), ...this.binaries.keys()] }
}

function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: 1,
    syncId: '1720000000000-abc123de',
    title: '여행 계획',
    body: '## 메모\n\n본문',
    folderId: null,
    tags: ['여행'],
    isStarred: false,
    color: 'blue',
    isPinned: false,
    createdAt: '2026-07-12T09:30:00.000Z',
    updatedAt: '2026-07-12T10:15:00.000Z',
    ...overrides,
  }
}

const noImages: ImageResolver = async () => undefined

// Minimal re-implementation of the service's write step, driving the real serializer
// against the in-memory target (the service's own step also manages debounce/locks/DB,
// which are not the subject here).
async function writeToTarget(
  target: MemoryFileSyncTarget,
  memo: Memo,
  folderName: string | undefined,
  resolve: ImageResolver,
  prevPath?: string,
) {
  const { filePath, content, assets } = await serializeMemo(memo, folderName, resolve)
  if (prevPath && prevPath !== filePath) await target.deleteFile(prevPath)
  await target.writeText(filePath, content)
  for (const a of assets) {
    if (!(await target.exists(a.path))) await target.writeBinary(a.path, new Blob([a.dataUrl]))
  }
  return { filePath, content }
}

describe('write flow (serializer → target)', () => {
  let target: MemoryFileSyncTarget
  beforeEach(() => { target = new MemoryFileSyncTarget() })

  it('writes a memo file at the folder-mapped path', async () => {
    await writeToTarget(target, makeMemo({ folderId: 2 }), '아이디어', noImages)
    expect(await target.listPaths()).toContain('아이디어/여행 계획-abc123.md')
  })

  it('writes referenced images to assets/ and rewrites the body link', async () => {
    const memo = makeMemo({ body: '![그림](memo-image:7)' })
    const resolve: ImageResolver = async () => ({ syncId: 'imgQ', data: 'data:image/png;base64,AAA' })
    const { content } = await writeToTarget(target, memo, undefined, resolve)
    expect(content).toContain('![그림](assets/imgQ.png)')
    expect(await target.exists('assets/imgQ.png')).toBe(true)
  })

  it('renames the file (deletes old path) when the title changes', async () => {
    const memo = makeMemo()
    const first = await writeToTarget(target, memo, undefined, noImages)
    expect(await target.exists(first.filePath)).toBe(true)

    const renamed = makeMemo({ title: '새 제목' })
    const second = await writeToTarget(target, renamed, undefined, noImages, first.filePath)
    expect(await target.exists(first.filePath)).toBe(false)
    expect(await target.exists(second.filePath)).toBe(true)
    expect(second.filePath).toBe('새 제목-abc123.md')
  })

  it('a no-op rewrite produces identical content (contentHash stable → service would skip)', async () => {
    const memo = makeMemo()
    const a = await serializeMemo(memo, undefined, noImages)
    const b = await serializeMemo(memo, undefined, noImages)
    expect(contentHash(a.content)).toBe(contentHash(b.content))
  })

  it('round-trips a written file back to the same memo fields', async () => {
    const memo = makeMemo({ tags: ['여행', '계획'], isPinned: true })
    const { filePath, content } = await writeToTarget(target, memo, undefined, noImages)
    const baseName = filePath.replace(/\.md$/, '')
    const parsed = deserializeMemo(content, baseName)
    expect(parsed.syncId).toBe(memo.syncId)
    expect(parsed.tags).toEqual(['여행', '계획'])
    expect(parsed.isPinned).toBe(true)
    expect(parsed.title).toBe('여행 계획')
  })
})

describe('Dexie v7 migration', () => {
  it('opens the database at version 7 with the device-local sync-folder stores', async () => {
    const { db, putFileSyncRecord, getFileSyncRecord, setSyncFolderValue, getSyncFolderValue } =
      await import('@/services/database')
    await db.open()
    // Dexie reports verno in units of 10.
    expect(db.verno).toBeGreaterThanOrEqual(7)

    await putFileSyncRecord({ memoSyncId: 's1', filePath: 'a/b.md', contentHash: 'deadbeef', lastWrittenAt: 'now' })
    const rec = await getFileSyncRecord('s1')
    expect(rec?.filePath).toBe('a/b.md')

    await setSyncFolderValue('probe', { hello: 'world' })
    expect(await getSyncFolderValue('probe')).toEqual({ hello: 'world' })
  })
})
