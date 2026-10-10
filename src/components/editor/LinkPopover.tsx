import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IcLineCheck } from '@/mw/icons'
import { TextField } from '@/mw/TextField'

interface LinkPopoverProps {
  /** 뷰포트 기준 앵커 좌표 — 팝오버 상단 중앙이 이 지점에 붙는다 */
  position: { top: number; left: number }
  initialUrl?: string
  /** 기존 링크 편집 시 제공 — '링크 해제' 행 노출 */
  onUnlink?: () => void
  onSubmit: (href: string) => void
  onClose: () => void
}

const PANEL_WIDTH = 280

/** 링크 삽입/편집 팝오버 — 네이티브 prompt() 를 대체하는 선택 영역 앵커드 패널 */
export function LinkPopover({ position, initialUrl = '', onUnlink, onSubmit, onClose }: LinkPopoverProps) {
  const [url, setUrl] = useState(initialUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  // 포털 마운트 직후 포커스 + 기존 URL 전체 선택 (바로 덮어쓰기 가능)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) {
      onClose()
      return
    }
    // 스킴이 없으면 https:// 를 보정 (내부 앵커/상대 경로/메일 제외)
    const href = /^(https?:|mailto:|tel:|#|\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`
    onSubmit(href)
  }

  // 뷰포트 클램핑 — 패널이 화면 밖(특히 키보드 뒤)으로 나가지 않게.
  // 세로는 visualViewport 가시영역 기준 — iOS는 키보드가 innerHeight를 안 줄이므로 필수.
  const vv = window.visualViewport
  const vvTop = vv?.offsetTop ?? 0
  const vvHeight = vv?.height ?? window.innerHeight
  const half = PANEL_WIDTH / 2
  const left = Math.min(Math.max(position.left, half + 8), window.innerWidth - half - 8)
  const top = Math.min(Math.max(position.top, vvTop + 8), vvTop + vvHeight - 104)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[var(--z-context-menu)]" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-label="링크 입력"
        className="fixed z-[var(--z-context-menu)] w-[280px] -translate-x-1/2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-1 animate-in fade-in zoom-in-95 duration-200 ease-enter"
        style={{ top: `${top}px`, left: `${left}px` }}
        // 키보드 액세서리 툴바의 컨테이너 mousedown preventDefault가
        // (포털을 통해 React 트리로 버블링되어) 입력 포커스를 막지 않도록 차단
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            submit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <div className="flex items-center gap-1">
          <TextField
            label="링크 주소"
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            showClearButton={false}
            containerClassName="min-w-0 flex-1"
          />
          <button type="button"
            onClick={submit}
            className="mw-icon-button shrink-0"
            aria-label="링크 적용"
          >
            <IcLineCheck size={16} />
          </button>
        </div>
        {onUnlink && (
          <button type="button"
            onClick={onUnlink}
            className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default mt-0.5 w-full"
          >
            <span>링크 끊기</span>
          </button>
        )}
      </div>
    </>,
    document.body
  )
}
