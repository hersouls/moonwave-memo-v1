import { useState, useRef } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { Download, Share2, X } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { useToastStore } from '@/stores/toastStore'
import { shareAsImage } from '@/utils/share'
import type { MemoColor } from '@/lib/types'

const CARD_BG: Record<MemoColor, string> = {
  white: 'from-zinc-50 to-zinc-100',
  yellow: 'from-amber-50 to-amber-100',
  green: 'from-emerald-50 to-emerald-100',
  blue: 'from-blue-50 to-blue-100',
  pink: 'from-pink-50 to-rose-100',
  purple: 'from-purple-50 to-violet-100',
}

interface ShareCardModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  body: string
  tags: string[]
  color: MemoColor
  date: string
}

export function ShareCardModal({ isOpen, onClose, title, body, tags, color, date }: ShareCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const bodyPreview = body
    .replace(/^#{1,6}\s/gm, '')
    .replace(/[*_~`>]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .trim()
    .slice(0, 280)

  const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleExport = async () => {
    if (!cardRef.current || exporting) return
    setExporting(true)
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      if (!blob) throw new Error('Failed to generate image')

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title || 'memo'}-card.png`
      a.click()
      URL.revokeObjectURL(url)
      useToastStore.getState().showToast('이미지가 저장되었습니다', 'success')
    } catch {
      useToastStore.getState().showToast('이미지 생성에 실패했습니다', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleShare = async () => {
    if (!cardRef.current || exporting) return
    setExporting(true)
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      if (!blob) throw new Error('Failed to generate image')
      const result = await shareAsImage(blob, title || 'Memo')
      if (result === 'copied') {
        useToastStore.getState().showToast('클립보드에 복사되었습니다', 'success')
      }
    } catch {
      useToastStore.getState().showToast('공유에 실패했습니다', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[var(--z-modal)]">
      <DialogBackdrop
        transition
        className="fixed inset-0 transition data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
        style={{ background: 'var(--overlay-bg)' }}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <DialogPanel
          transition
          className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-800 shadow-xl p-5 transition duration-300 data-[closed]:translate-y-4 data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in"
        >
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              공유 카드
            </DialogTitle>
            <button onClick={onClose} className="f-icon-btn" aria-label="닫기">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Card preview */}
          <div className="flex justify-center mb-4">
            <div
              ref={cardRef}
              className={`w-[360px] min-h-[200px] bg-gradient-to-br ${CARD_BG[color]} rounded-2xl p-6 flex flex-col`}
              style={{ fontFamily: "'Pretendard', sans-serif" }}
            >
              {title && (
                <h2 className="text-xl font-bold text-zinc-900 mb-3 leading-snug">
                  {title}
                </h2>
              )}
              {bodyPreview && (
                <p className="text-sm text-zinc-700 leading-relaxed flex-1 whitespace-pre-line">
                  {bodyPreview}{body.length > 280 ? '...' : ''}
                </p>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="text-xs text-zinc-500 bg-white/60 px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/5">
                <span className="text-[10px] text-zinc-500">{formattedDate}</span>
                <span className="text-[10px] font-medium text-zinc-400">Memo by Moonwave</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              이미지 저장
            </button>
            <button
              onClick={handleShare}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              공유
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
