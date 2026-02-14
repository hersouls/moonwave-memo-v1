import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowRight, Check, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface OnboardingStep {
  target: string
  title: string
  message: string
  position: 'top' | 'bottom'
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="add-task"]',
    title: '작업 추가',
    message: '+ 버튼을 눌러 새로운 할 일을 등록합니다',
    position: 'bottom',
  },
  {
    target: '[data-onboarding="category-tabs"]',
    title: '카테고리 관리',
    message: '카테고리별로 작업을 분류하고 관리합니다',
    position: 'top',
  },
  {
    target: '[data-onboarding="calendar-nav"]',
    title: '캘린더 보기',
    message: '캘린더에서 날짜별 작업을 확인합니다',
    position: 'bottom',
  },
]

const STORAGE_KEY = 'onboarding_complete'

export function OnboardingOverlay() {
  const [step, setStep] = useState(0)
  const [isComplete, setIsComplete] = useState(true) // Start as true to prevent flash
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY) === 'true'
    setIsComplete(completed)
  }, [])

  // Focus overlay for keyboard navigation
  useEffect(() => {
    if (!isComplete && overlayRef.current) {
      overlayRef.current.focus()
    }
  }, [isComplete, step])

  // Update target element position
  const updateTargetPosition = useCallback(() => {
    if (isComplete) return

    const currentStep = ONBOARDING_STEPS[step]
    const element = document.querySelector(currentStep.target)

    if (element) {
      const rect = element.getBoundingClientRect()
      setTargetRect(rect)
    } else {
      setTargetRect(null)
    }
  }, [step, isComplete])

  useEffect(() => {
    updateTargetPosition()

    // Update on resize/scroll
    window.addEventListener('resize', updateTargetPosition)
    window.addEventListener('scroll', updateTargetPosition, true)

    return () => {
      window.removeEventListener('resize', updateTargetPosition)
      window.removeEventListener('scroll', updateTargetPosition, true)
    }
  }, [updateTargetPosition])

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsComplete(true)
  }

  const handleSkip = () => handleComplete()

  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        handleNext()
        break
      case 'Escape':
        e.preventDefault()
        handleSkip()
        break
      case 'ArrowRight':
        e.preventDefault()
        handleNext()
        break
      case 'ArrowLeft':
        e.preventDefault()
        handlePrev()
        break
    }
  }

  // Don't render if complete
  if (isComplete) return null

  const currentStep = ONBOARDING_STEPS[step]
  const isLastStep = step === ONBOARDING_STEPS.length - 1

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!targetRect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const padding = 16
    const tooltipWidth = 320

    // Center horizontally relative to target
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2

    // Keep tooltip within viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding))

    if (currentStep.position === 'bottom') {
      return {
        left: `${left}px`,
        top: `${targetRect.bottom + padding}px`,
      }
    } else {
      return {
        left: `${left}px`,
        bottom: `${window.innerHeight - targetRect.top + padding}px`,
      }
    }
  }

  return (
    <div
      ref={overlayRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[60] outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="온보딩 가이드"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 transition-opacity" />

      {/* Spotlight - highlight target element */}
      {targetRect && (
        <div
          className="absolute bg-transparent rounded-lg ring-4 ring-primary-500 ring-offset-4 ring-offset-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        className="absolute w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-zinc-900/50 border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        style={getTooltipStyle()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {currentStep.title}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="온보딩 건너뛰기"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {currentStep.message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50">
          {/* Progress Dots */}
          <div className="flex gap-1.5">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === step
                    ? 'bg-primary-500'
                    : 'bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500'
                }`}
                aria-label={`${index + 1}단계로 이동`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                이전
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLastStep ? (
                <>
                  완료
                  <Check className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  다음
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
