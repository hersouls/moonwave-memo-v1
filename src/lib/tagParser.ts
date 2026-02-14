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
