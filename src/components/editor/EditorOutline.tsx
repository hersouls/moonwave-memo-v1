import { useMemo } from 'react'
import clsx from 'clsx'
import { IcLineClose, IcMwList } from '@/mw/icons'

interface Heading {
  level: number
  text: string
  line: number
}

export function parseHeadings(body: string): Heading[] {
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
            <IcMwList size={16} />
            목차
          </div>
          <button type="button"
            onClick={onClose}
            className="mw-icon-button"
            aria-label="목차 닫기"
          >
            <IcLineClose size={16} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            마크다운 제목(# ~ ####)을<br />쓰면 여기에 목차가<br />자동으로 만들어져요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <IcMwList size={16} />
          목차
          <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {headings.length}
          </span>
        </div>
        <button type="button"
          onClick={onClose}
          className="mw-icon-button"
          aria-label="목차 닫기"
        >
          <IcLineClose size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-1">
        <OutlineList headings={headings} onScrollToLine={onScrollToLine} onScrollToHeadingIndex={onScrollToHeadingIndex} />
      </div>
    </div>
  )
}

/** 목차의 줄들이에요. 누르면 편집기가 그 제목으로 가요. 목차 칸과 넓은 화면의 정보 칸이 함께 써요. */
export function OutlineList({ headings, onScrollToLine, onScrollToHeadingIndex }: { headings: Heading[]; onScrollToLine: (line: number) => void; onScrollToHeadingIndex?: (index: number) => void }) {
  const minLevel = Math.min(...headings.map((h) => h.level))
  return (
    <nav aria-label="문서 목차">
      {headings.map((heading, index) => (
        <button type="button"
          key={heading.line}
          onClick={() => onScrollToHeadingIndex ? onScrollToHeadingIndex(index) : onScrollToLine(heading.line)}
          className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default w-full justify-start truncate"
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
  )
}
