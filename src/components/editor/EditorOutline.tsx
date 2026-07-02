import { useMemo } from 'react'
import { List, X } from 'lucide-react'
import clsx from 'clsx'

interface Heading {
  level: number
  text: string
  line: number
}

function parseHeadings(body: string): Heading[] {
  const headings: Heading[] = []
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,4})\s+(.+)/)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[*_`~[\]]/g, '').trim(),
        line: i,
      })
    }
  }
  return headings
}

interface EditorOutlineProps {
  body: string
  onScrollToLine: (line: number) => void
  onScrollToHeadingIndex?: (index: number) => void
  onClose: () => void
}

export function EditorOutline({ body, onScrollToLine, onScrollToHeadingIndex, onClose }: EditorOutlineProps) {
  const headings = useMemo(() => parseHeadings(body), [body])

  if (headings.length === 0) {
    return (
      <div className="h-full flex flex-col border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <List className="w-3.5 h-3.5" />
            목차
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 transition-colors"
            aria-label="목차 닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            마크다운 헤딩(# ~ ####)을<br />사용하면 여기에 목차가<br />자동 생성됩니다.
          </p>
        </div>
      </div>
    )
  }

  const minLevel = Math.min(...headings.map((h) => h.level))

  return (
    <div className="h-full flex flex-col border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <List className="w-3.5 h-3.5" />
          목차
          <span className="ml-1 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
            {headings.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 transition-colors"
          aria-label="목차 닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-1" aria-label="문서 목차">
        {headings.map((heading, index) => (
          <button
            key={heading.line}
            onClick={() => onScrollToHeadingIndex ? onScrollToHeadingIndex(index) : onScrollToLine(heading.line)}
            className={clsx(
              'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors',
              'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 hover:text-zinc-900 dark:hover:text-zinc-200',
              'truncate block'
            )}
            style={{ paddingLeft: `${(heading.level - minLevel) * 12 + 10}px` }}
            title={heading.text}
          >
            <span className={clsx(
              heading.level === 1 && 'font-semibold text-zinc-800 dark:text-zinc-200',
              heading.level === 2 && 'font-medium',
            )}>
              {heading.text}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}
