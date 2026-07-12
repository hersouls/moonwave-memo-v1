import { describe, it, expect } from 'vitest'
import type { Memo } from '@/lib/types'
import { sanitizeSegment, shortId, memoFileName, imageExtension } from '../filename'
import { serializeFrontmatter, parseFile, FILE_SCHEMA_VERSION } from '../frontmatter'
import { serializeMemo, deserializeMemo, type ImageResolver } from '../serializer'
import { contentHash } from '../hash'

function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: 1,
    syncId: '1720000000000-abc123de',
    title: '여행 계획',
    body: '## 메모\n\n#여행 준비물 정리',
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

describe('filename', () => {
  it('strips Windows/NAS-invalid characters', () => {
    expect(sanitizeSegment('a/b:c*d?e"f<g>h|i')).toBe('a b c d e f g h i')
  })

  it('preserves hyphens (they are valid and the shortId separator)', () => {
    expect(sanitizeSegment('to-do list')).toBe('to-do list')
  })

  it('escapes Windows reserved device names', () => {
    expect(sanitizeSegment('CON')).toBe('_CON')
    expect(sanitizeSegment('lpt1')).toBe('_lpt1')
  })

  it('removes trailing dots and spaces', () => {
    expect(sanitizeSegment('report...  ')).toBe('report')
  })

  it('falls back for empty / whitespace-only titles', () => {
    expect(sanitizeSegment('')).toBe('무제')
    expect(sanitizeSegment('   ', '제목-없음')).toBe('제목-없음')
  })

  it('caps very long segments', () => {
    expect(sanitizeSegment('가'.repeat(200)).length).toBeLessThanOrEqual(80)
  })

  it('derives a stable 6-char shortId from a syncId', () => {
    expect(shortId('1720000000000-abc123de')).toBe('abc123')
    // Deterministic — same input, same output (no random churn).
    expect(shortId('1720000000000-abc123de')).toBe(shortId('1720000000000-abc123de'))
  })

  it('builds a memo filename as <title>-<shortId>.md', () => {
    expect(memoFileName(makeMemo())).toBe('여행 계획-abc123.md')
    expect(memoFileName(makeMemo({ title: '' }))).toBe('제목-없음-abc123.md')
  })

  it('infers image extension from a data URL', () => {
    expect(imageExtension('data:image/png;base64,AAAA')).toBe('png')
    expect(imageExtension('data:image/jpeg;base64,AAAA')).toBe('jpg')
    expect(imageExtension('data:image/svg+xml;base64,AAAA')).toBe('svg')
    expect(imageExtension('not-a-data-url')).toBe('png')
  })
})

describe('frontmatter', () => {
  it('round-trips known fields', () => {
    const block = serializeFrontmatter({
      syncId: 'm1',
      schemaVersion: FILE_SCHEMA_VERSION,
      createdAt: '2026-07-12T09:30:00.000Z',
      updatedAt: '2026-07-12T10:15:00.000Z',
      folder: '아이디어',
      tags: ['a', 'b'],
      color: 'blue',
      isPinned: false,
      isStarred: true,
    })
    const { frontmatter: fm, body, hasFrontmatter } = parseFile(`${block}\n\n본문입니다.`)
    expect(hasFrontmatter).toBe(true)
    expect(fm.syncId).toBe('m1')
    expect(fm.tags).toEqual(['a', 'b'])
    expect(fm.color).toBe('blue')
    expect(fm.isStarred).toBe(true)
    expect(fm.isPinned).toBe(false)
    expect(fm.folder).toBe('아이디어')
    expect(body).toBe('본문입니다.')
  })

  it('round-trips realistic tags (Korean / letters / digits / underscore)', () => {
    // extractTags only ever produces [가-힣a-zA-Z0-9_]+ tags, so the emitter/parser
    // is targeted at that shape (no commas/colons possible inside a tag).
    const block = serializeFrontmatter({
      syncId: 'm2', schemaVersion: 1, createdAt: 'x', updatedAt: 'y',
      tags: ['프로젝트_A', 'v2', '한글태그'], isPinned: false, isStarred: false,
    })
    const { frontmatter: fm } = parseFile(`${block}\n\nbody`)
    expect(fm.tags).toEqual(['프로젝트_A', 'v2', '한글태그'])
  })

  it('parses an empty tag list', () => {
    const block = serializeFrontmatter({
      syncId: 'm2', schemaVersion: 1, createdAt: 'x', updatedAt: 'y',
      tags: [], isPinned: false, isStarred: false,
    })
    const { frontmatter: fm } = parseFile(`${block}\n\nbody`)
    expect(fm.tags).toEqual([])
  })

  it('preserves unknown keys from externally-authored files on round-trip', () => {
    const text = '---\nsyncId: m3\ncustomKey: hello\n---\n\nbody'
    const { frontmatter: fm } = parseFile(text)
    expect(fm.extra.customKey).toBe('hello')
    const re = serializeFrontmatter({
      syncId: fm.syncId!, schemaVersion: 1, createdAt: 'x', updatedAt: 'y',
      tags: [], isPinned: false, isStarred: false, extra: fm.extra,
    })
    expect(re).toContain('customKey: hello')
  })

  it('treats a plain markdown file (no fence) as body-only', () => {
    const { hasFrontmatter, body } = parseFile('# Just a note\n\ncontent')
    expect(hasFrontmatter).toBe(false)
    expect(body).toBe('# Just a note\n\ncontent')
  })
})

describe('serializer', () => {
  it('serializes a root memo without duplicating the title into the body', async () => {
    const result = await serializeMemo(makeMemo(), undefined, noImages)
    expect(result.filePath).toBe('여행 계획-abc123.md')
    expect(result.dirSegments).toEqual([])
    expect(result.content).toContain('syncId: 1720000000000-abc123de')
    expect(result.content).toContain('## 메모')
    // The title heading must NOT be injected into the body (legacy export bug).
    expect(result.content).not.toContain('# 여행 계획\n')
  })

  it('maps a foldered memo into a subdirectory', async () => {
    const result = await serializeMemo(makeMemo({ folderId: 3 }), '아이디어', noImages)
    expect(result.dirSegments).toEqual(['아이디어'])
    expect(result.filePath).toBe('아이디어/여행 계획-abc123.md')
    expect(result.content).toContain('folder: 아이디어')
  })

  it('rewrites memo-image links to relative asset paths and collects assets (root)', async () => {
    const memo = makeMemo({ body: '![그림](memo-image:5)\n\n설명' })
    const resolve: ImageResolver = async (id) =>
      id === 5 ? { syncId: 'img-xyz', data: 'data:image/png;base64,AAA' } : undefined
    const result = await serializeMemo(memo, undefined, resolve)
    expect(result.content).toContain('![그림](assets/img-xyz.png)')
    expect(result.assets).toEqual([{ path: 'assets/img-xyz.png', dataUrl: 'data:image/png;base64,AAA' }])
  })

  it('prefixes asset paths with ../ for memos one folder deep', async () => {
    const memo = makeMemo({ body: '![그림](memo-image:5)' })
    const resolve: ImageResolver = async () => ({ syncId: 'img-xyz', data: 'data:image/jpeg;base64,AAA' })
    const result = await serializeMemo(memo, '아이디어', resolve)
    expect(result.content).toContain('![그림](../assets/img-xyz.jpg)')
  })

  it('leaves unresolvable image references untouched', async () => {
    const memo = makeMemo({ body: '![x](memo-image:999)' })
    const result = await serializeMemo(memo, undefined, noImages)
    expect(result.content).toContain('memo-image:999')
    expect(result.assets).toEqual([])
  })

  it('round-trips a serialized memo back to fields', async () => {
    const memo = makeMemo({ tags: ['여행', '계획'] })
    const { content, fileName } = await serializeMemo(memo, undefined, noImages)
    const baseName = fileName.replace(/\.md$/, '')
    const parsed = deserializeMemo(content, baseName)
    expect(parsed.syncId).toBe(memo.syncId)
    expect(parsed.tags).toEqual(['여행', '계획'])
    expect(parsed.color).toBe('blue')
    expect(parsed.title).toBe('여행 계획')
    expect(parsed.hasFrontmatter).toBe(true)
    expect(parsed.body.trim()).toBe(memo.body.trim())
  })

  it('treats a front-matter-less file as a new memo with a filename-derived title', () => {
    const parsed = deserializeMemo('그냥 내용만 있는 파일', '자유-메모-abc123')
    expect(parsed.hasFrontmatter).toBe(false)
    expect(parsed.syncId).toBeUndefined()
    expect(parsed.title).toBe('자유-메모')
  })
})

describe('contentHash', () => {
  it('is deterministic', () => {
    expect(contentHash('hello')).toBe(contentHash('hello'))
  })
  it('changes when content changes', () => {
    expect(contentHash('hello')).not.toBe(contentHash('hello!'))
  })
  it('returns an 8-char hex string', () => {
    expect(contentHash('anything')).toMatch(/^[0-9a-f]{8}$/)
  })
})
