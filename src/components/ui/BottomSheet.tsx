import { Fragment, useState, type ReactNode } from 'react'
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
        }
        setDragY(0)
      }
    },
    { axis: 'y', filterTaps: true, pointer: { touch: true } }
  )

  const progress = Math.min(dragY / 200, 1)

  return (
    <Transition show={isOpen} as={Fragment} afterLeave={() => { setDragY(0); setIsDragging(false) }}>
      <Dialog onClose={onClose} className="relative z-50">
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
            className="fixed inset-0 bg-black/40"
            aria-hidden="true"
            style={dragY > 0 ? { opacity: 1 - progress * 0.5 } : undefined}
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
              className="w-full max-h-[85vh] fold:max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white pb-safe dark:bg-zinc-900"
              style={{
                transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
                transition: isDragging ? 'none' : 'transform 0.2s ease',
              }}
            >
              {/* Drag handle */}
              <div {...bind()} className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none">
                <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              </div>

              {title && (
                <DialogTitle className="border-b border-zinc-100 px-5 pb-3 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  {title}
                </DialogTitle>
              )}

              <div className="px-5 py-4">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
