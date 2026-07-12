import { describe, it, expect } from 'vitest'
import { decideImport } from '../importer'
import type { DeserializedMemo } from '../serializer'

function parsed(over: Partial<DeserializedMemo> = {}): DeserializedMemo {
  return { body: 'b', tags: [], isPinned: false, isStarred: false, hasFrontmatter: true, ...over }
}

describe('decideImport (§4.4/§4.5/§4.6)', () => {
  it('unlink of a tracked file → soft-delete its memo', () => {
    expect(
      decideImport({ type: 'unlink', relPath: 'a.md' }, { record: { memoSyncId: 's1', contentHash: 'h' } }),
    ).toEqual({ action: 'delete', memoSyncId: 's1' })
  })

  it('unlink of an untracked file → skip', () => {
    expect(decideImport({ type: 'unlink', relPath: 'a.md' }, { record: null }).action).toBe('skip')
  })

  it('§4.6 self-write: change whose hash equals the record → skip', () => {
    expect(
      decideImport(
        { type: 'change', relPath: 'a.md', content: 'x' },
        { fileHash: 'h', record: { memoSyncId: 's1', contentHash: 'h' }, parsed: parsed() },
      ),
    ).toEqual({ action: 'skip', reason: 'self-write' })
  })

  it('§4.5 conflict: external edit OLDER than app state → skip (app wins)', () => {
    expect(
      decideImport(
        { type: 'change', relPath: 'a.md', content: 'x' },
        {
          fileHash: 'h2',
          record: { memoSyncId: 's1', contentHash: 'h1' },
          recordMemo: { updatedAt: '2026-07-12T10:00:00.000Z' },
          parsed: parsed({ updatedAt: '2026-07-12T09:00:00.000Z' }),
        },
      ),
    ).toEqual({ action: 'skip', reason: 'app-newer' })
  })

  it('§4.5 conflict: external edit NEWER than app state → update', () => {
    const d = decideImport(
      { type: 'change', relPath: 'a.md', content: 'x' },
      {
        fileHash: 'h2',
        record: { memoSyncId: 's1', contentHash: 'h1' },
        recordMemo: { updatedAt: '2026-07-12T09:00:00.000Z' },
        parsed: parsed({ updatedAt: '2026-07-12T10:00:00.000Z' }),
      },
    )
    expect(d).toMatchObject({ action: 'update', memoSyncId: 's1' })
  })

  it('tracked file with no front-matter timestamp → update (external edit applied)', () => {
    const d = decideImport(
      { type: 'change', relPath: 'a.md', content: 'x' },
      {
        fileHash: 'h2',
        record: { memoSyncId: 's1', contentHash: 'h1' },
        recordMemo: { updatedAt: '2026-07-12T09:00:00.000Z' },
        parsed: parsed({ updatedAt: undefined }),
      },
    )
    expect(d.action).toBe('update')
  })

  it('§4.4 moved file: new path, front-matter syncId maps to existing memo → update', () => {
    expect(
      decideImport(
        { type: 'add', relPath: 'moved.md', content: 'x' },
        { fileHash: 'h', record: null, frontmatterMemoExists: true, parsed: parsed({ syncId: 's9' }) },
      ),
    ).toMatchObject({ action: 'update', memoSyncId: 's9' })
  })

  it('§4.4 brand-new file without front-matter → create + writeBack', () => {
    expect(
      decideImport(
        { type: 'add', relPath: 'new.md', content: 'x' },
        { fileHash: 'h', record: null, parsed: parsed({ hasFrontmatter: false }) },
      ),
    ).toMatchObject({ action: 'create', writeBack: true })
  })

  it('new file WITH front-matter but unknown syncId → create, no writeBack', () => {
    expect(
      decideImport(
        { type: 'add', relPath: 'new.md', content: 'x' },
        { fileHash: 'h', record: null, frontmatterMemoExists: false, parsed: parsed({ syncId: 's-unknown', hasFrontmatter: true }) },
      ),
    ).toMatchObject({ action: 'create', writeBack: false })
  })

  it('change event with no content/parsed → skip', () => {
    expect(decideImport({ type: 'change', relPath: 'a.md' }, { record: null })).toEqual({
      action: 'skip',
      reason: 'no-content',
    })
  })
})
