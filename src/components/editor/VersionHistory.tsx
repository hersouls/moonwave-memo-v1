import { useState, useEffect } from 'react'
import { History, RotateCcw, X } from 'lucide-react'
import { createPortal } from 'react-dom'
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
            <span key={i} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
              {part.value}
            </span>
          )
        }
        if (part.removed) {
          return (
            <span key={i} className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through">
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

  useEffect(() => {
    setIsLoading(true)
    getVersionsByMemoId(memoId).then((v) => {
      setVersions(v)
      setIsLoading(false)
    })
  }, [memoId])

  const selected = selectedIdx !== null ? versions[selectedIdx] : null

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <History className="h-5 w-5 text-primary-500" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex-1">버전 기록</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Timeline sidebar */}
          <div className="w-48 shrink-0 border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-zinc-400">로딩 중...</div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-sm text-zinc-400">버전 기록이 없습니다.</div>
            ) : (
              <div className="py-2">
                {versions.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedIdx === idx
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="font-medium">{formatDateTime(v.createdAt)}</div>
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                      {v.title || '제목 없음'}
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
                      onClose()
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    이 버전으로 복원
                  </button>
                </div>

                {selected.title !== currentTitle && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-zinc-400 mb-1">제목 변경</div>
                    <DiffView oldText={selected.title} newText={currentTitle} />
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-zinc-400 mb-1">본문 변경</div>
                  <DiffView oldText={selected.body} newText={currentBody} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-zinc-400">
                왼쪽에서 버전을 선택하세요
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
