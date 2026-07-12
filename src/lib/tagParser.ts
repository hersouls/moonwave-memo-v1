/**
 * Extract hashtags from text.
 * Matches #word patterns (Korean, English, numbers, underscores).
 */
export function extractTags(text: string): string[] {
  const regex = /#([가-힣a-zA-Z0-9_]+)/g
  const tags: string[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const tag = match[1]
    if (!tags.includes(tag)) {
      tags.push(tag)
    }
  }
  return tags
}

/**
 * Highlight hashtags in text by wrapping them in a span.
 */
export function highlightTags(text: string): string {
  return text.replace(
    /#([가-힣a-zA-Z0-9_]+)/g,
    '<span class="text-primary-500 font-medium">#$1</span>'
  )
}

/**
 * Merge tags when the body changes: body-hashtag additions/removals are applied,
 * while field-only tags (AI-generated or manually added — never present in the
 * body) are preserved. This is the contract that lets tags live outside the body:
 * a field-only tag can only be removed through the tag edit UI, not by editing text.
 */
export function mergeTagsOnBodyChange(oldTags: string[], oldBody: string, newBody: string): string[] {
  const oldBodyTags = extractTags(oldBody)
  const newBodyTags = extractTags(newBody)
  const fieldOnly = oldTags.filter((t) => !oldBodyTags.includes(t))
  return [...new Set([...newBodyTags, ...fieldOnly])]
}

/**
 * Normalize tags to the same shape extractTags produces:
 * strip leading '#', spaces become '_', drop characters outside [가-힣a-zA-Z0-9_], dedupe.
 * No count cap — user-entered tags must never be silently truncated.
 */
export function normalizeTags(raw: string[]): string[] {
  const out: string[] = []
  for (const r of raw) {
    const tag = r
      .replace(/^#+/, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^가-힣a-zA-Z0-9_]/g, '')
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out
}

/** AI 제안 태그 정규화 — normalizeTags + 최대 5개 (AI 결과 폭주 방지용 컷). */
export function normalizeAITags(raw: string[]): string[] {
  return normalizeTags(raw).slice(0, 5)
}
