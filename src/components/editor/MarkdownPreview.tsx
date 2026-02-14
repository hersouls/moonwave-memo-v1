import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import { getMemoImage } from '@/services/database'
import { useMemoStore } from '@/stores/memoStore'
import '@/styles/markdown.css'

// Module-level cache to avoid re-fetching images
const imageCache = new Map<number, string>()

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
        imageCache.set(imageId, img.data)
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
      <span className="text-zinc-400 dark:text-zinc-500 text-sm italic">
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

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const memos = useMemoStore((s) => s.memos)

  const processedContent = useMemo(
    () => processMemoLinks(content, memos),
    [content, memos]
  )

  if (!content.trim()) {
    return (
      <div className={`memo-markdown-preview ${className ?? ''}`}>
        <p className="text-zinc-400 dark:text-zinc-500 italic">
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
