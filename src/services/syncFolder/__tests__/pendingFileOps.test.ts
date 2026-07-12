import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  db,
  enqueuePendingFileOp,
  getDuePendingFileOps,
  deletePendingFileOpsByTarget,
  countPendingFileOps,
  clearPendingFileOps,
} from '@/services/database'

function op(over: Record<string, unknown> = {}) {
  return {
    op: 'writeText' as const,
    targetKey: 'ipc:Z:\\NAS\\Memo',
    filePath: 'a.md',
    payload: 'x',
    attempts: 0,
    nextRetryAt: '2020-01-01T00:00:00.000Z',
    createdAt: '2020-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('pendingFileOps queue (§4.6)', () => {
  beforeEach(async () => {
    await db.open()
    await clearPendingFileOps()
  })

  it('dedupes by (targetKey, filePath) — a newer op supersedes the old one', async () => {
    await enqueuePendingFileOp(op({ payload: 'v1' }))
    await enqueuePendingFileOp(op({ payload: 'v2' }))
    expect(await countPendingFileOps()).toBe(1)
    const all = await db.pendingFileOps.toArray()
    expect(all[0].payload).toBe('v2')
  })

  it('keeps ops for different paths separate', async () => {
    await enqueuePendingFileOp(op({ filePath: 'a.md' }))
    await enqueuePendingFileOp(op({ filePath: 'b.md' }))
    expect(await countPendingFileOps()).toBe(2)
  })

  it('returns only ops whose nextRetryAt is due', async () => {
    await enqueuePendingFileOp(op({ filePath: 'past.md', nextRetryAt: '2020-01-01T00:00:00.000Z' }))
    await enqueuePendingFileOp(op({ filePath: 'future.md', nextRetryAt: '2999-01-01T00:00:00.000Z' }))
    const due = await getDuePendingFileOps('2021-01-01T00:00:00.000Z')
    expect(due.map((o) => o.filePath)).toEqual(['past.md'])
  })

  it('drops all ops for a removed mirror target', async () => {
    await enqueuePendingFileOp(op({ targetKey: 'ipc:Z:\\A', filePath: '1.md' }))
    await enqueuePendingFileOp(op({ targetKey: 'ipc:Z:\\A', filePath: '2.md' }))
    await enqueuePendingFileOp(op({ targetKey: 'ipc:Z:\\B', filePath: '3.md' }))
    await deletePendingFileOpsByTarget('ipc:Z:\\A')
    expect(await countPendingFileOps()).toBe(1)
    const rest = await db.pendingFileOps.toArray()
    expect(rest[0].targetKey).toBe('ipc:Z:\\B')
  })
})
