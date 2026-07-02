import { useState, useEffect, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import { getMemoImage } from '@/services/database'
import { useMemoStore } from '@/stores/memoStore'
import '@/styles/markdown.css'

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
        [이미지를 찾을 수 없습니다]
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

  return (
    <div className="relative group">
      {language && (
        <div className="absolute top-0 left-0 px-2 py-0.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-800 dark:bg-zinc-900 rounded-br-md rounded-tl-md uppercase">
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="코드 복사"
      >
        {copied ? '복사됨' : '복사'}
      </button>
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
          미리보기할 내용이 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div className={`memo-markdown-preview ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
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
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (!onCheckboxToggle) return
                    // Find the nth checkbox occurrence to determine the line index
                    const checkboxes = content.split('\n')
                    let checkboxIndex = 0
                    const allCheckboxEls = document.querySelectorAll('.memo-markdown-preview input[type="checkbox"]')
                    const currentEl = props as any
                    for (let i = 0; i < allCheckboxEls.length; i++) {
                      if (allCheckboxEls[i] === (currentEl?.ref?.current ?? null)) {
                        checkboxIndex = i
                        break
                      }
                    }
                    // Count through lines to find the matching checkbox
                    let count = 0
                    for (let i = 0; i < checkboxes.length; i++) {
                      if (/^\s*-\s\[[ xX]\]/.test(checkboxes[i])) {
                        if (count === checkboxIndex) {
                          onCheckboxToggle(i, !checked)
                          return
                        }
                        count++
                      }
                    }
                    // Fallback: toggle by sequential index
                    let idx = 0
                    for (let i = 0; i < checkboxes.length; i++) {
                      if (/^\s*-\s\[[ xX]\]/.test(checkboxes[i])) {
                        idx = i
                        break
                      }
                    }
                    onCheckboxToggle(idx, !checked)
                  }}
                  className="cursor-pointer accent-primary-500"
                  {...props}
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
                  className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline decoration-primary-300 dark:decoration-primary-700"
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
