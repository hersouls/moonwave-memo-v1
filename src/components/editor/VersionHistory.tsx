import { useState, useEffect, useCallback } from 'react'
import { DialogBackdrop, DialogPanel, DialogTitle, Dialog as HeadlessDialog } from '@headlessui/react'
import { History, RotateCcw, X } from 'lucide-react'
import { diffWords } from 'diff'
import type { MemoVersion } from '@/lib/types'
import { getVersionsByMemoId } from '@/services/database'

interface VersionHistoryProps {
  memoId: number
  currentTitle: string
  currentBody: string
  onRestore: (title: string, body: string) => void
  onClose: () => void
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const changes = diffWords(oldText, newText)

  return (
    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-zinc-700 dark:text-zinc-300">
      {changes.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} className="bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-300">
              {part.value}
            </span>
          )
        }
        if (part.removed) {
          return (
            <span key={i} className="bg-danger-100 dark:bg-danger-900/30 text-danger-800 dark:text-danger-300 line-through">
              {part.value}
            </span>
          )
        }
        return <span key={i}>{part.value}</span>
      })}
    </pre>
  )
}

export function VersionHistory({ memoId, currentTitle, currentBody, onRestore, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<MemoVersion[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // 조건부 마운트(lazy) 환경에서 퇴장 애니메이션을 재생하기 위한 내부 open 상태:
  // 닫힘 트랜지션(200ms)이 끝난 뒤 부모 onClose로 언마운트한다
  const [open, setOpen] = useState(true)

  const requestClose = useCallback(() => {
    setOpen(false)
    window.setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    setIsLoading(true)
    getVersionsByMemoId(memoId).then((v) => {
      setVersions(v)
      setIsLoading(false)
    })
  }, [memoId])

  const selected = selectedIdx !== null ? versions[selectedIdx] : null

  return (
    <HeadlessDialog open={open} onClose={requestClose} className="relative z-[var(--z-modal)]">
      {/* Backdrop */}
      <DialogBackdrop
        transition
        className="fixed inset-0 transition data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
        style={{ background: 'var(--overlay-bg)' }}
      />

      {/* Panel — 우측 드로어, 양방향 슬라이드 */}
      <div className="fixed inset-0 flex">
        <DialogPanel
          transition
          className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white dark:bg-zinc-900 shadow-2xl transition data-[closed]:translate-x-full data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
        >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <History className="h-5 w-5 text-primary-500" />
          <DialogTitle as="h2" className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex-1">버전 기록</DialogTitle>
          <button
            onClick={requestClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="닫기"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Timeline sidebar */}
          <div className="w-48 shrink-0 border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">로딩 중...</div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">버전 기록이 없습니다.</div>
            ) : (
              <div className="py-3 px-3">
                {versions.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedIdx(idx)}
                    className="w-full flex items-start gap-2.5 text-left group"
                  >
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center shrink-0 pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                        selectedIdx === idx
                          ? 'bg-primary-500 border-primary-500'
                          : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 group-hover:border-primary-400'
                      }`} />
                      {idx < versions.length - 1 && (
                        <div className="w-px flex-1 min-h-[24px] bg-zinc-200 dark:bg-zinc-700 mt-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`flex-1 pb-3 rounded-lg px-2 py-1.5 -mt-0.5 transition-colors ${
                      selectedIdx === idx
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}>
                      <div className={`text-sm font-medium ${
                        selectedIdx === idx
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {formatDateTime(v.createdAt)}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {v.title || '제목 없음'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Diff view */}
          <div className="flex-1 overflow-y-auto p-5">
            {selected ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(selected.createdAt)} 버전과 현재 비교
                  </h3>
                  <button
                    onClick={() => {
                      onRestore(selected.title, selected.body)
                      requestClose()
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    이 버전으로 복원
                  </button>
                </div>

                {selected.title !== currentTitle && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">제목 변경</div>
                    <DiffView oldText={selected.title} newText={currentTitle} />
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">본문 변경</div>
                  <DiffView oldText={selected.body} newText={currentBody} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-zinc-500 dark:text-zinc-400">
                왼쪽에서 버전을 선택하세요
              </div>
            )}
          </div>
        </div>
        </DialogPanel>
      </div>
    </HeadlessDialog>
  )
}
