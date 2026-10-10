import { useState, useEffect, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import { sanitizeSchema } from '@/lib/markdownHtml'
import { getMemoImage } from '@/services/database'
import { useMemoStore } from '@/stores/memoStore'
import '@/styles/markdown.css'
import { Checkbox } from '@/mw/Checkbox'
import { taskLineIndexes } from '@/utils/checklistParser'

// Module-level cache to avoid re-fetching images (capped to prevent memory leaks)
const IMAGE_CACHE_MAX = 50
const imageCache = new Map<number, string>()

function setCachedImage(id: number, data: string) {
  if (imageCache.size >= IMAGE_CACHE_MAX && !imageCache.has(id)) {
    const oldest = imageCache.keys().next().value
    if (oldest !== undefined) imageCache.delete(oldest)
  }
  imageCache.set(id, data)
}

function MemoImageRenderer({ imageId, alt }: { imageId: number; alt: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(imageCache.get(imageId) ?? null)
  const [loading, setLoading] = useState(!imageCache.has(imageId))

  useEffect(() => {
    if (imageCache.has(imageId)) {
      setDataUrl(imageCache.get(imageId)!)
      setLoading(false)
      return
    }

    let cancelled = false
    getMemoImage(imageId).then((img) => {
      if (!cancelled && img) {
        setCachedImage(imageId, img.data)
        setDataUrl(img.data)
      }
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [imageId])

  if (loading) {
    return (
      <div className="animate-pulse bg-zinc-200 dark:bg-zinc-700 rounded-lg h-32 w-full" />
    )
  }

  if (!dataUrl) {
    return (
      <span className="text-zinc-500 dark:text-zinc-400 text-sm italic">
        [이미지를 찾지 못했어요]
      </span>
    )
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      className="max-w-full rounded-lg"
    />
  )
}

// Convert [[memo title]] to clickable links
function processMemoLinks(content: string, memos: { id?: number; title: string; deletedAt?: string }[]): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
    const target = memos.find((m) => !m.deletedAt && m.title === title)
    if (target?.id) {
      return `[${title}](#/memo/${target.id} "메모 링크")`
    }
    return match
  })
}

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match?.[1]

  const handleCopy = useCallback(() => {
    const text = String(children).replace(/\n$/, '')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => { /* clipboard access denied */ })
  }, [children])

  // Inline code (no language class)
  if (!className) {
    return <code className={className} {...props}>{children}</code>
  }

  // 언어 이름과 복사 버튼은 코드 위의 한 줄이에요. 코드 위에 겹쳐 띄우면 첫 줄을 가리고, 손가락으로 쓰는 화면에서는 복사 버튼이 보이지 않아요.
  return (
    <div>
      <div className="flex items-center justify-between gap-2 pl-4 pr-1">
        <span className="text-xs font-mono uppercase text-[var(--text-secondary)]">{language}</span>
        <button type="button"
          onClick={handleCopy}
          className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
          aria-label="코드 복사"
        >
          <span>{copied ? '복사했어요' : '복사'}</span>
        </button>
      </div>
      <code className={className} {...props}>{children}</code>
    </div>
  )
}

interface MarkdownPreviewProps {
  content: string
  className?: string
  onCheckboxToggle?: (lineIndex: number, checked: boolean) => void
}

export function MarkdownPreview({ content, className, onCheckboxToggle }: MarkdownPreviewProps) {
  const memos = useMemoStore((s) => s.memos)

  const processedContent = useMemo(
    () => processMemoLinks(content, memos),
    [content, memos]
  )

  if (!content.trim()) {
    return (
      <div className={`memo-markdown-preview ${className ?? ''}`}>
        <p className="text-zinc-500 dark:text-zinc-400 italic">
          미리 볼 내용이 아직 없어요.
        </p>
      </div>
    )
  }

  return (
    <div className={`memo-markdown-preview ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        // §8: sanitize AFTER rehype-raw (strips XSS from raw HTML) and BEFORE
        // rehype-highlight (so hljs classes, added later, survive).
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeHighlight]}
        components={{
          img: ({ src, alt, ...props }) => {
            if (src?.startsWith('memo-image:')) {
              const imageId = parseInt(src.replace('memo-image:', ''), 10)
              if (!isNaN(imageId)) {
                return <MemoImageRenderer imageId={imageId} alt={alt || ''} />
              }
            }
            return <img src={src} alt={alt} {...props} />
          },
          code: ({ className, children, ...props }) => (
            <CodeBlock className={className} {...props}>{children}</CodeBlock>
          ),
          // 할 일 줄은 키트의 체크박스 항목이에요: 줄 전체(높이 44px)가 눌려요
          li: ({ className, children, ...props }) => (
            String(className ?? '').includes('task-list-item')
              ? <li className={className} {...props}><label className="mw-checkbox-item">{children}</label></li>
              : <li className={className} {...props}>{children}</li>
          ),
          // 표는 키트의 Table이에요 (줄 높이와 칸의 여백은 키트가 정해요)
          table: ({ children }) => (
            <div className="mw-table" role="group" aria-label="표" tabIndex={0}>
              <table className="mw-table__table">{children}</table>
            </div>
          ),
          th: ({ children }) => <th scope="col" className="mw-table__header">{children}</th>,
          td: ({ children }) => <td className="mw-table__cell">{children}</td>,
          input: ({ type, checked, value: _value, ...props }) => {
            if (type === 'checkbox') {
              // 미리보기에서 할 일을 눌러 마칠 수 있어요. 누른 체크가 화면에서 몇 번째인지로 본문의 줄을 찾아요.
              // (GFM은 이 체크를 늘 disabled로 내려 줘서, 바꿀 수 있을 때는 그 값을 덮어요.)
              return (
                <Checkbox
                  value="task"
                  aria-label={checked ? '마친 일' : '할 일'}
                  checked={!!checked}
                  {...props}
                  disabled={!onCheckboxToggle}
                  onChange={(event) => {
                    if (!onCheckboxToggle) return
                    const root = event.currentTarget.closest('.memo-markdown-preview')
                    const boxes = root ? Array.from(root.querySelectorAll('input[type="checkbox"]')) : []
                    const line = taskLineIndexes(content)[boxes.indexOf(event.currentTarget)]
                    if (line != null) onCheckboxToggle(line, !checked)
                  }}
                />
              )
            }
            return <input type={type} checked={checked} {...props} />
          },
          a: ({ href, children, ...props }) => {
            // Internal memo links
            if (href?.startsWith('#/memo/')) {
              return (
                <a
                  href={href}
                  className="text-primary-500 hover:text-primary-600 underline decoration-primary-300 "
                  {...props}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            )
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
