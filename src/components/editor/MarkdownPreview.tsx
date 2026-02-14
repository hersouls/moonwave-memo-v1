import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import '@/styles/markdown.css'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
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
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
