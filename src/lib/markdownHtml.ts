/**
 * Safe Markdown → HTML conversion + the shared sanitize schema (Phase 4 · §8).
 *
 * Two consumers share ONE sanitize schema so the security policy is defined once:
 *   - MarkdownPreview (live rendering) plugs `rehypeSanitize` with this schema after
 *     rehype-raw, closing the pre-existing XSS hole (raw HTML was rendered unsanitized).
 *   - markdownToSafeHtml() produces a sanitized HTML string for file/share export.
 *
 * The schema extends rehype-sanitize's GitHub default with exactly what the app needs:
 * the in-app `memo-image:` src scheme, task-list `checked`, and img `alt`/`title`.
 * Everything dangerous (scripts, event handlers, javascript:/data: hrefs, iframes,
 * svg/foreignObject) stays blocked by the default.
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import remarkStringify from 'remark-stringify'
import rehypeRaw from 'rehype-raw'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { Schema } from 'hast-util-sanitize'

export const sanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), 'alt', 'title'],
    input: [...(defaultSchema.attributes?.input ?? []), 'checked'],
  },
  protocols: {
    ...defaultSchema.protocols,
    // Allow the app-internal image scheme (MarkdownPreview resolves it) and data: for
    // inline base64 images — safe in an <img> context (SVG scripts don't run there),
    // while data: in dangerous elements (iframe/object) stays blocked by tagNames.
    src: [...(defaultSchema.protocols?.src ?? []), 'memo-image', 'data'],
  },
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify)

/** Convert Markdown (incl. inline raw HTML) to a sanitized HTML fragment string. */
export function markdownToSafeHtml(markdown: string): string {
  return String(processor.processSync(markdown ?? ''))
}

// ─── HTML → Markdown (Phase 4 M2 · import) ───────────
// Untrusted HTML is sanitized (shared schema) BEFORE conversion, so a malicious
// import can never inject script/handlers into the resulting memo.
const htmlToMdProcessor = unified()
  .use(rehypeParse)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: '-', fences: true })

/** Convert an (untrusted) HTML string to sanitized Markdown for import. */
export function htmlToMarkdown(html: string): string {
  return String(htmlToMdProcessor.processSync(html ?? '')).trim()
}

/** Wrap a sanitized HTML body fragment into a styled, standalone HTML document. */
export function wrapHtmlDocument(title: string, bodyHtml: string, metaComment?: string): string {
  const safeTitle = (title || 'Memo').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>${metaComment ? `\n${metaComment}` : ''}
<style>
  body { font-family: 'Pretendard', -apple-system, system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #18181b; line-height: 1.7; }
  h1,h2,h3 { line-height: 1.3; }
  code { background: #f4f4f5; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre { background: #f4f4f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  a { color: #3b82f6; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  blockquote { border-left: 3px solid #d4d4d8; padding-left: 1rem; color: #71717a; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #e4e4e7; padding: 0.4rem 0.6rem; text-align: left; }
</style>
</head>
<body>
${title ? `<h1>${safeTitle}</h1>\n` : ''}${bodyHtml}
</body>
</html>`
}
