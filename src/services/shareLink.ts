import { markdownToSafeHtml } from '@/lib/markdownHtml'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function generateShareHTML(title: string, body: string, tags: string[]): string {
  // Real Markdown → sanitized HTML (§8): preserves tables/links/nested lists/code
  // blocks and strips XSS, unlike the old regex converter.
  const html = markdownToSafeHtml(body)

  // Escape title for use in HTML
  const safeTitle = escapeHtml(title || 'Memo')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    h2 { font-size: 1.25rem; margin-top: 1.5rem; }
    h3 { font-size: 1.1rem; margin-top: 1.25rem; }
    code { background: #f4f4f5; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    a { color: #3b82f6; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    pre { background: #f4f4f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #d4d4d8; padding-left: 1rem; color: #71717a; margin: 0.5rem 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #e4e4e7; padding: 0.4rem 0.6rem; text-align: left; }
    .tags { margin-top: 2rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .tag { background: #eff6ff; color: #3b82f6; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 0.75rem; }
  </style>
</head>
<body>
  ${title ? `<h1>${safeTitle}</h1>` : ''}
  <div>${html}</div>
  ${tags.length > 0 ? `<div class="tags">${tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  <div class="footer">Memo by Moonwave</div>
</body>
</html>`
}
