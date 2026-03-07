/**
 * SEC-01: Mask sensitive data patterns (API keys, tokens, secrets)
 */
export function maskSensitiveData(text: string): string {
  return text
    .replace(/sk-proj-[A-Za-z0-9_-]{10,}/g, 'sk-proj-****')
    .replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, 'sk-ant-****')
    .replace(/sk-[A-Za-z0-9_-]{32,}/g, 'sk-****')
    .replace(/key-[A-Za-z0-9_-]{20,}/g, 'key-****')
    .replace(
      /(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi,
      (match) => match.slice(0, 15) + '****'
    )
}

/**
 * UX-13: Strip markdown syntax for plain-text preview
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')           // code blocks
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')          // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')    // links
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2')       // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')          // italic
    .replace(/~~(.*?)~~/g, '$1')              // strikethrough
    .replace(/^[-*+]\s+/gm, '')              // unordered lists
    .replace(/^\d+\.\s+/gm, '')              // ordered lists
    .replace(/^>\s+/gm, '')                  // blockquotes
    .replace(/---+/g, '')                     // horizontal rules
    .replace(/\n{2,}/g, ' ')                 // collapse newlines
    .trim()
}
