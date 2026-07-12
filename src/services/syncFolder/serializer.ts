/**
 * Memo ⇄ file serialization (§4.1 본문 + §4.2 이미지/첨부).
 *
 * Serialize: a memo becomes front-matter + body, with embedded `memo-image:{id}`
 * links (the app-internal, device-local image scheme) rewritten to relative
 * `assets/…` paths so the file is portable to Obsidian/external tools. The title is
 * NOT duplicated into the body (unlike the legacy per-memo export), so a round-trip
 * import doesn't push the heading into the content.
 *
 * Deserialize: parse a file back into memo fields for the Phase 2 import path (§4.4).
 */
import type { Memo, MemoColor } from '@/lib/types'
import { imageExtension, memoFileName, sanitizeSegment } from './filename'
import {
  FILE_SCHEMA_VERSION,
  parseFile,
  serializeFrontmatter,
  type MemoFrontmatter,
} from './frontmatter'

/** A binary asset (image) that must be written alongside the memo file. */
export interface AssetRef {
  /** Path relative to the sync-folder root, e.g. `assets/<imageSyncId>.png`. */
  path: string
  /** base64 data URL of the image (from Dexie memoImages). */
  dataUrl: string
}

export interface SerializedMemo {
  /** File name only (no directory), e.g. `여행-계획-abc123.md`. */
  fileName: string
  /** Directory segments under the root ([] = root, ['아이디어'] = one folder deep). */
  dirSegments: string[]
  /** Full file path relative to root, e.g. `아이디어/여행-계획-abc123.md`. */
  filePath: string
  /** Full file text (front-matter + rewritten body). */
  content: string
  /** Images referenced by the body, to be written under the root `assets/` dir. */
  assets: AssetRef[]
}

export type ImageResolver = (numericId: number) => Promise<{ syncId: string; data: string } | undefined>

const MEMO_IMAGE_RE = /(!\[[^\]]*\]\()memo-image:(\d+)(\))/g
const VALID_COLORS: MemoColor[] = ['white', 'yellow', 'green', 'blue', 'pink', 'purple']

/**
 * Rewrite `memo-image:{id}` links to relative asset paths and collect the assets.
 * Assets live in a single top-level `assets/` dir; memos one folder deep reference
 * them with a `../` prefix. Unresolvable references are left untouched.
 */
async function rewriteImages(
  body: string,
  depth: number,
  resolve: ImageResolver,
): Promise<{ body: string; assets: AssetRef[] }> {
  const assets: AssetRef[] = []
  const seen = new Set<string>()
  const prefix = depth > 0 ? '../' : ''

  // Collect the numeric ids first (regex + async resolution don't mix in .replace).
  const ids = new Set<number>()
  for (const m of body.matchAll(MEMO_IMAGE_RE)) ids.add(Number(m[2]))

  const map = new Map<number, string>() // numericId -> relative path from this memo
  for (const id of ids) {
    const img = await resolve(id)
    if (!img) continue
    const assetName = `${img.syncId}.${imageExtension(img.data)}`
    const rootPath = `assets/${assetName}`
    if (!seen.has(rootPath)) {
      seen.add(rootPath)
      assets.push({ path: rootPath, dataUrl: img.data })
    }
    map.set(id, `${prefix}${rootPath}`)
  }

  const rewritten = body.replace(MEMO_IMAGE_RE, (whole, open, idStr, close) => {
    const rel = map.get(Number(idStr))
    return rel ? `${open}${rel}${close}` : whole
  })

  return { body: rewritten, assets }
}

/** Build front-matter metadata from a memo. */
function toFrontmatter(memo: Memo, folderName?: string): MemoFrontmatter {
  return {
    syncId: memo.syncId ?? '',
    schemaVersion: FILE_SCHEMA_VERSION,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt,
    folder: folderName,
    tags: memo.tags ?? [],
    color: memo.color,
    isPinned: !!memo.isPinned,
    isStarred: !!memo.isStarred,
  }
}

/**
 * Serialize a memo to its file representation.
 * @param folderName sanitized display name of the memo's folder, or undefined for root.
 */
export async function serializeMemo(
  memo: Memo,
  folderName: string | undefined,
  resolveImage: ImageResolver,
): Promise<SerializedMemo> {
  const dirSegments = folderName ? [sanitizeSegment(folderName)] : []
  const fileName = memoFileName(memo)
  const filePath = [...dirSegments, fileName].join('/')

  const { body, assets } = await rewriteImages(memo.body ?? '', dirSegments.length, resolveImage)
  const frontmatter = serializeFrontmatter(toFrontmatter(memo, folderName))
  const content = `${frontmatter}\n\n${body.trimEnd()}\n`

  return { fileName, dirSegments, filePath, content, assets }
}

export interface DeserializedMemo {
  syncId?: string
  title?: string
  body: string
  tags: string[]
  color?: MemoColor
  isPinned: boolean
  isStarred: boolean
  createdAt?: string
  updatedAt?: string
  folder?: string
  hasFrontmatter: boolean
}

/**
 * Parse a memo file back into fields for import (§4.4). `fileBaseName` (without the
 * `.md` extension and the `-<shortId>` suffix) is used as the title fallback when the
 * front-matter carries none — e.g. an externally-authored plain markdown file.
 */
export function deserializeMemo(text: string, fileBaseName?: string): DeserializedMemo {
  const { frontmatter: fm, body, hasFrontmatter } = parseFile(text)
  const color = fm.color && VALID_COLORS.includes(fm.color as MemoColor) ? (fm.color as MemoColor) : undefined
  const title = deriveTitle(fileBaseName, body)
  return {
    syncId: fm.syncId,
    title,
    body,
    tags: fm.tags ?? [],
    color,
    isPinned: !!fm.isPinned,
    isStarred: !!fm.isStarred,
    createdAt: fm.createdAt,
    updatedAt: fm.updatedAt,
    folder: fm.folder,
    hasFrontmatter,
  }
}

/** Strip the `-<6charShortId>` suffix a serialized file name carries, for title fallback. */
function deriveTitle(fileBaseName: string | undefined, body: string): string | undefined {
  if (fileBaseName) {
    const stripped = fileBaseName.replace(/-[a-zA-Z0-9]{6}$/, '')
    if (stripped.trim()) return stripped.trim()
  }
  // Last resort: first non-empty line of the body
  const firstLine = body.split(/\r?\n/).find((l) => l.trim())
  return firstLine?.replace(/^#+\s*/, '').trim() || undefined
}
