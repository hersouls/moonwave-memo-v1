import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { useDrag } from '@use-gesture/react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  // 드래그 중단 후 스냅백 — 스프링 이징 250ms 동안만 인라인 transition 적용
  const [isSnapping, setIsSnapping] = useState(false)
  const snapTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (snapTimer.current !== null) window.clearTimeout(snapTimer.current)
    },
    []
  )

  const bind = useDrag(
    ({ active, movement: [, my], velocity: [, vy] }) => {
      if (my < 0) {
        setDragY(0)
        return
      }
      setIsDragging(active)
      if (active) {
        setDragY(Math.max(0, my))
      } else {
        if (my > 100 || vy > 0.5) {
          onClose()
        } else {
          setIsSnapping(true)
          if (snapTimer.current !== null) window.clearTimeout(snapTimer.current)
          snapTimer.current = window.setTimeout(() => setIsSnapping(false), 250)
        }
        setDragY(0)
      }
    },
    { axis: 'y', filterTaps: true, pointer: { touch: true } }
  )

  const progress = Math.min(dragY / 200, 1)

  return (
    <Transition show={isOpen} as={Fragment} afterLeave={() => { setDragY(0); setIsDragging(false); setIsSnapping(false) }}>
      <Dialog onClose={onClose} className="relative z-[var(--z-modal)]">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0"
            aria-hidden="true"
            style={{
              background: 'var(--overlay-bg)',
              opacity: dragY > 0 ? 1 - progress * 0.5 : undefined,
            }}
          />
        </TransitionChild>

        {/* Sheet */}
        <div className="fixed inset-0 flex items-end">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
            <DialogPanel
              className="sheet-panel w-full overflow-y-auto"
              style={{
                transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
                transition: isDragging
                  ? 'none'
                  : isSnapping
                    ? 'transform 250ms var(--ease-spring)'
                    : undefined,
              }}
            >
              {/* 드래그 영역 — 핸들 + 헤더 전체가 dismiss 제스처를 받는다 (44px 터치 타깃 확보) */}
              <div {...bind()} className="touch-none cursor-grab active:cursor-grabbing">
                <div className="sheet-drag-handle" />

                {title && (
                  <div className="sheet-header">
                    <DialogTitle className="sheet-header__title">
                      {title}
                    </DialogTitle>
                  </div>
                )}
              </div>

              <div className="sheet-content py-4">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
