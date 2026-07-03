import {
  DialogBackdrop,
  DialogPanel,
  Dialog as HeadlessDialog,
} from '@headlessui/react'
import clsx from 'clsx'
import type { ReactNode } from 'react'

interface MemoEditorModalProps {
  children: ReactNode
  onClose: () => void
}

export function MemoEditorModal({ children, onClose }: MemoEditorModalProps) {
  return (
    <HeadlessDialog open={true} onClose={onClose} className="relative z-[var(--z-modal)]">
      {/* 풀스크린 테이크오버 — 캐노니컬 스크림 토큰 + blur-sm (블러 정책상 유일하게 허용) */}
      <DialogBackdrop
        transition
        className={clsx(
          'fixed inset-0 backdrop-blur-sm',
          'transition data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in'
        )}
        style={{ background: 'var(--overlay-bg)' }}
      />

      <div className="fixed inset-0 overflow-hidden flex items-center justify-center p-4 lg:p-8">
        <DialogPanel
          transition
          className={clsx(
            'w-full max-w-5xl h-[85dvh] fold:h-[75dvh]',
            'bg-white dark:bg-zinc-900',
            'rounded-2xl shadow-2xl',
            'ring-1 ring-zinc-200 dark:ring-zinc-700',
            'overflow-hidden flex flex-col',
            'transition duration-300 data-[closed]:opacity-0 data-[closed]:scale-95',
            'data-[enter]:ease-out data-[leave]:ease-in data-[leave]:duration-200'
          )}
        >
          {children}
        </DialogPanel>
      </div>
    </HeadlessDialog>
  )
}
