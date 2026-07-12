/**
 * File & directory naming for the sync folder (§4.1 파일명 규칙).
 *
 * Titles are free-form and frequently empty/duplicated, so a raw `제목.md` scheme
 * is unsafe on Windows/NAS. This module produces sanitized, collision-resistant,
 * stable filenames:
 *   - illegal chars (\ / : * ? " < > |) stripped
 *   - Windows reserved device names (CON, PRN, ...) escaped
 *   - trailing dots/spaces removed
 *   - Unicode normalized to NFC (macOS produces NFD, Windows expects NFC)
 *   - empty titles fall back to a fixed label
 *   - a stable 6-char suffix from the memo's syncId disambiguates duplicates and
 *     keeps the filename derived purely from (title, syncId) — identical inputs
 *     always yield the identical name, so no random churn on autosave.
 */

const MAX_SEGMENT_LEN = 80

// Windows/NAS-forbidden characters. Space and hyphen are intentionally excluded —
// hyphens are valid and are the shortId separator; whitespace runs are collapsed
// separately below. Raw control chars can't occur in a single-line title input.
const INVALID_CHARS = /[\\/:*?"<>|]/g
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Sanitize a single path segment (a file base name or a directory name). */
export function sanitizeSegment(name: string, fallback = '무제'): string {
  let s = (name ?? '').normalize('NFC').replace(INVALID_CHARS, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  // Windows forbids trailing dots and spaces
  s = s.replace(/[. ]+$/g, '').trim()
  if (!s) return fallback
  if (RESERVED.test(s)) s = `_${s}`
  if (s.length > MAX_SEGMENT_LEN) s = s.slice(0, MAX_SEGMENT_LEN).trim()
  return s || fallback
}

/** Stable 6-char suffix derived from a memo/image syncId (`<ms>-<base36>`). */
export function shortId(syncId: string): string {
  const rand = syncId.includes('-') ? syncId.split('-').pop()! : syncId
  const cleaned = (rand || '').replace(/[^a-zA-Z0-9]/g, '')
  return (cleaned.slice(0, 6) || '000000').padEnd(6, '0')
}

/** The `.md` filename for a memo: `<sanitized-title>-<shortId>.md`. */
export function memoFileName(memo: { title: string; syncId?: string }): string {
  const base = sanitizeSegment(memo.title, '제목-없음')
  const suffix = memo.syncId ? shortId(memo.syncId) : '000000'
  return `${base}-${suffix}.md`
}

/** Extension for an image asset, inferred from a data URL's MIME type. */
export function imageExtension(dataUrl: string): string {
  const m = /^data:image\/([a-zA-Z0-9.+-]+);/.exec(dataUrl)
  const raw = (m?.[1] || 'png').toLowerCase()
  if (raw === 'jpeg') return 'jpg'
  if (raw === 'svg+xml') return 'svg'
  return raw.replace(/[^a-z0-9]/g, '') || 'png'
}
