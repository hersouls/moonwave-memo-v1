function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function generateShareHTML(title: string, body: string, tags: string[]): string {
  // Escape HTML tags in body first, then convert markdown to HTML
  const html = escapeHtml(body)
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^- \[x\] (.*$)/gm, '<div style="display:flex;align-items:center;gap:6px"><input type="checkbox" checked disabled>$1</div>')
    .replace(/^- \[ \] (.*$)/gm, '<div style="display:flex;align-items:center;gap:6px"><input type="checkbox" disabled>$1</div>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^> (.*$)/gm, '<blockquote style="border-left:3px solid #d4d4d8;padding-left:1rem;color:#71717a;margin:0.5rem 0">$1</blockquote>')
    .replace(/\n/g, '<br>')

  // Escape title for use in HTML
  const safeTitle = (title || 'Memo').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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
    li { margin-left: 1.5rem; }
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
