/**
 * YAML front-matter for memo files (§4.1 파일 포맷 & 정체성).
 *
 * The front-matter carries the stable identity (`syncId`) and metadata that a bare
 * `.md` body cannot represent (tags, color, pin/star, timestamps, folder). This is
 * what lets the Phase 2 watcher match an edited file back to a memo instead of
 * creating a duplicate, and what makes conflict resolution timestamp-based rather
 * than mtime-based.
 *
 * We intentionally avoid a YAML dependency (none is in package.json). This is a
 * minimal emitter/parser covering exactly the scalar + string-array shapes we write.
 * For robustness on externally-authored files, unknown keys are preserved verbatim
 * (§10 forward-compatibility) so a round-trip never silently drops fields.
 */

export const FILE_SCHEMA_VERSION = 1

export interface MemoFrontmatter {
  syncId: string
  schemaVersion: number
  createdAt: string
  updatedAt: string
  folder?: string
  tags: string[]
  color?: string
  isPinned: boolean
  isStarred: boolean
  /** Unknown keys from externally-authored files, preserved on round-trip. */
  extra?: Record<string, string>
}

export interface ParsedFile {
  frontmatter: Partial<MemoFrontmatter> & { extra: Record<string, string> }
  body: string
  /** true when a well-formed `---` front-matter block was present. */
  hasFrontmatter: boolean
}

const KNOWN_KEYS = new Set([
  'syncId', 'schemaVersion', 'createdAt', 'updatedAt', 'folder', 'tags', 'color', 'isPinned', 'isStarred',
])

function needsQuoting(s: string): boolean {
  return s === '' || /[:#[\]{}",&*!|>%@`]/.test(s) || /^\s|\s$/.test(s) || /^[-?]/.test(s)
}

function emitScalar(value: string): string {
  if (needsQuoting(value)) return JSON.stringify(value)
  return value
}

function emitTags(tags: string[]): string {
  if (!tags.length) return '[]'
  return `[${tags.map(emitScalar).join(', ')}]`
}

/** Serialize memo metadata into a `---`-fenced front-matter block (no trailing newline). */
export function serializeFrontmatter(fm: MemoFrontmatter): string {
  const lines: string[] = ['---']
  lines.push(`syncId: ${emitScalar(fm.syncId)}`)
  lines.push(`schemaVersion: ${fm.schemaVersion}`)
  lines.push(`createdAt: ${emitScalar(fm.createdAt)}`)
  lines.push(`updatedAt: ${emitScalar(fm.updatedAt)}`)
  if (fm.folder) lines.push(`folder: ${emitScalar(fm.folder)}`)
  lines.push(`tags: ${emitTags(fm.tags)}`)
  if (fm.color) lines.push(`color: ${emitScalar(fm.color)}`)
  lines.push(`isPinned: ${fm.isPinned}`)
  lines.push(`isStarred: ${fm.isStarred}`)
  // Preserve unknown keys from external files last, so our known keys stay canonical.
  if (fm.extra) {
    for (const [k, v] of Object.entries(fm.extra)) {
      if (!KNOWN_KEYS.has(k)) lines.push(`${k}: ${emitScalar(v)}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

function unquote(raw: string): string {
  const s = raw.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    if (s.startsWith('"')) {
      try { return JSON.parse(s) as string } catch { /* fall through */ }
    }
    return s.slice(1, -1)
  }
  return s
}

function parseTags(raw: string): string[] {
  const s = raw.trim()
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map((t) => unquote(t)).map((t) => t.trim()).filter(Boolean)
  }
  if (!s) return []
  // Tolerate a plain comma or space separated list
  return s.split(/[,]/).map((t) => unquote(t).trim()).filter(Boolean)
}

/**
 * Split a file's text into front-matter + body. When no `---` block is present
 * (an externally-created plain `.md`), the whole text is the body and
 * `hasFrontmatter` is false — the import layer (§4.4) treats that as a new memo.
 */
export function parseFile(text: string): ParsedFile {
  const normalized = text.replace(/^﻿/, '')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(normalized)
  if (!match) {
    return { frontmatter: { extra: {} }, body: normalized.replace(/^\s*\n/, ''), hasFrontmatter: false }
  }

  const block = match[1]
  // Drop the single blank line the serializer writes between the fence and the body.
  const body = normalized.slice(match[0].length).replace(/^\r?\n/, '')
  const fm: Partial<MemoFrontmatter> & { extra: Record<string, string> } = { extra: {} }

  for (const line of block.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const rawValue = line.slice(idx + 1).trim()
    switch (key) {
      case 'syncId': fm.syncId = unquote(rawValue); break
      case 'schemaVersion': fm.schemaVersion = Number(rawValue) || FILE_SCHEMA_VERSION; break
      case 'createdAt': fm.createdAt = unquote(rawValue); break
      case 'updatedAt': fm.updatedAt = unquote(rawValue); break
      case 'folder': fm.folder = unquote(rawValue); break
      case 'tags': fm.tags = parseTags(rawValue); break
      case 'color': fm.color = unquote(rawValue); break
      case 'isPinned': fm.isPinned = rawValue === 'true'; break
      case 'isStarred': fm.isStarred = rawValue === 'true'; break
      default: fm.extra[key] = unquote(rawValue); break
    }
  }

  return { frontmatter: fm, body, hasFrontmatter: true }
}
