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
    :root { --ink: #18181b; --muted: #71717a; --soft: #f4f4f5; --line: #e4e4e7; --rule: #d4d4d8; --link: #315f7e; }
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: var(--ink); line-height: 1.7; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    h2 { font-size: 1.25rem; margin-top: 1.5rem; }
    h3 { font-size: 1.1rem; margin-top: 1.25rem; }
    code { background: var(--soft); padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    a { color: var(--link); }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    pre { background: var(--soft); padding: 1rem; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid var(--rule); padding-left: 1rem; color: var(--muted); margin: 0.5rem 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid var(--line); padding: 0.4rem 0.6rem; text-align: left; }
    .tags { margin-top: 2rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .tag { background: var(--soft); color: var(--link); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.75rem; }
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
