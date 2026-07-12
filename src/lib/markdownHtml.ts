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
import rehypeRaw from 'rehype-raw'
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
