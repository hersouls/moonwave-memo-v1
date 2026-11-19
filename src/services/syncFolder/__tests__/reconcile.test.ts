import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import type { FileSyncTarget } from '../FileSyncTarget'

/* 맞춰 보기(reconcile): 주 폴더 쓰기가 실패해 빠진 메모, 기록은 있는데 파일이 사라진 메모를 다시 써요.
   2026-11 운영 점검에서 메모 43개가 이렇게 NAS · 검색에서 빠져 있었어요. */

class MemoryTarget implements FileSyncTarget {
  readonly key = 'memory'
  files = new Map<string, string>()
  failWrites = false
  async writeText(path: string, text: string) {
    if (this.failWrites) throw new Error('offline')
    this.files.set(path, text)
  }
  async writeBinary() {}
  async deleteFile(path: string) { this.files.delete(path) }
  async exists(path: string) { return this.files.has(path) }
  async ensureDir() {}
  async removeDir() {}
  async listPaths() { return [...this.files.keys()] }
}

const target = new MemoryTarget()

vi.mock('@/services/firestoreSync', () => ({ pushMemo: vi.fn() }))
vi.mock('../platform', () => ({
  isSyncFolderSupported: () => true,
  isElectron: () => false,
  pickFolder: vi.fn(),
  pickMirror: vi.fn(),
  buildIpcTarget: () => null,
  restoreTarget: async () => ({ status: 'ok', target, displayName: 'NAS' }),
  requestPermissionFor: vi.fn(),
  watchRootFromRef: () => null,
}))

const { db, setSyncFolderValue } = await import('@/services/database')
const { useSyncFolderStore } = await import('@/stores/syncFolderStore')
const svc = await import('../syncFolderService')

const memo = (n: number, updatedAt = '2026-11-01T00:00:00.000Z') => ({
  syncId: `1790000000000-memo${n}xx`,
  title: `메모 ${n}`,
  body: `본문 ${n}`,
  folderId: null,
  tags: [],
  isStarred: false,
  color: 'white' as const,
  isPinned: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt,
})

describe('reconcileSyncFolder', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    target.files.clear()
    target.failWrites = false
    await db.memos.clear()
    await db.fileSyncMap.clear()
    useSyncFolderStore.getState().setEnabled(true)
    await setSyncFolderValue('dirHandle', { kind: 'fsa' })
    await svc.initSyncFolder()
  })

  it('파일이 없는 메모를 모두 써요', async () => {
    await db.memos.bulkAdd([memo(1), memo(2), memo(3)])
    const r = await svc.reconcileSyncFolder({ verify: true })
    expect(r.written).toBe(3)
    expect(target.files.size).toBe(3)
    // 한 번 더 돌면 할 일이 없어요
    expect((await svc.reconcileSyncFolder({ verify: true })).written).toBe(0)
  })

  it('기록은 있는데 폴더에서 사라진 파일을 다시 써요 (전체 내보내기는 이 경우를 건너뛰어요)', async () => {
    await db.memos.bulkAdd([memo(1), memo(2)])
    await svc.reconcileSyncFolder({ verify: true })
    const [first] = target.files.keys()
    target.files.delete(first)
    // 가볍게 맞춰 보기는 파일 목록을 보지 않아요
    expect((await svc.reconcileSyncFolder()).written).toBe(0)
    const r = await svc.reconcileSyncFolder({ verify: true })
    expect(r.written).toBe(1)
    expect(target.files.has(first)).toBe(true)
  })

  it('쓰기가 실패한 메모는 다음 맞춰 보기에서 써요', async () => {
    await db.memos.bulkAdd([memo(1)])
    target.failWrites = true
    expect((await svc.reconcileSyncFolder()).failed).toBe(1)
    target.failWrites = false
    expect((await svc.reconcileSyncFolder()).written).toBe(1)
    expect(target.files.size).toBe(1)
  })
})
