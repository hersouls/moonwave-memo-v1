import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDrag } from '@use-gesture/react'
import clsx from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSlideParser } from './useSlideParser'
import { SlideRenderer } from './SlideRenderer'
import { IcFillPlay, IcLineAdd, IcLineChevronLeft, IcLineChevronRight, IcLineClose, IcLineMinus, IcLinePause, IcMwColumns, IcMwList, IcMwMoon, IcMwSun } from '@/mw/icons'

const AUTO_PLAY_INTERVALS = [5, 10, 30] as const

export function SlideView() {
  const slideViewMemoId = useUIStore((s) => s.slideViewMemoId)
  const closeSlideView = useUIStore((s) => s.closeSlideView)
  const isDesktop = useUIStore((s) => s.isDesktop)

  const memos = useMemoStore((s) => s.memos)
  const folders = useFolderStore((s) => s.folders)

  const memo = slideViewMemoId != null
    ? memos.find((m) => m.id === slideViewMemoId)
    : null

  const folderName = memo?.folderId
    ? folders.find((f) => f.id === memo.folderId)?.name ?? null
    : null

  const { slides, totalSlides } = useSlideParser(
    memo?.body ?? '',
    memo?.title ?? '',
    memo?.createdAt ?? '',
    folderName
  )

  // View mode: slide (horizontal) or scroll (vertical)
  const [viewMode, setViewMode] = useState<'slide' | 'scroll'>('scroll')

  // Slide mode state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [transitionClass, setTransitionClass] = useState('slide-fade-in')
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [autoPlayInterval, setAutoPlayInterval] = useState<number>(10)

  // Shared state
  const [fontSize, setFontSize] = useState(1.0)
  const [slideTheme, setSlideTheme] = useState<'light' | 'dark'>('light')
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isClosing, setIsClosing] = useState(false)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const isSlideMode = viewMode === 'slide'

  // Reset state when memo changes
  useEffect(() => {
    setCurrentIndex(0)
    setTransitionClass('slide-fade-in')
    setIsAutoPlaying(false)
    setViewMode('scroll')
    setIsClosing(false)

    const isDark = document.documentElement.dataset.theme === 'dark'
    setSlideTheme(isDark ? 'dark' : 'light')
  }, [slideViewMemoId])

  // Animated close: play exit animation, then actually unmount (reduced-motion skips straight to close)
  const requestClose = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeSlideView()
      return
    }
    setIsClosing(true)
  }, [closeSlideView])

  // iOS-safe body scroll lock
  useBodyScrollLock(slideViewMemoId != null)

  // Navigation (slide mode only)
  const goTo = useCallback((index: number, direction: 'left' | 'right') => {
    if (index < 0 || index >= totalSlides) return
    setTransitionClass(direction === 'right' ? 'slide-enter-right' : 'slide-enter-left')
    setCurrentIndex(index)
    resetControlsTimer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSlides])

  const goNext = useCallback(() => {
    if (currentIndex < totalSlides - 1) goTo(currentIndex + 1, 'right')
  }, [currentIndex, totalSlides, goTo])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1, 'left')
  }, [currentIndex, goTo])

  // Keyboard handler (capture phase)
  useEffect(() => {
    if (slideViewMemoId == null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape always works
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        requestClose()
        return
      }

      // In scroll mode, let browser handle all other keys (scrolling)
      if (!isSlideMode) return

      e.stopPropagation()
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault()
          goNext()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          goPrev()
          break
        case 'Home':
          e.preventDefault()
          goTo(0, 'left')
          break
        case 'End':
          e.preventDefault()
          goTo(totalSlides - 1, 'right')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [slideViewMemoId, isSlideMode, goNext, goPrev, goTo, requestClose, totalSlides])

  // Touch swipe (slide mode only)
  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx] }) => {
      if (!isSlideMode) return
      if (!active) {
        if (Math.abs(mx) > 80 || vx > 0.5) {
          if (dx < 0) goNext()
          else goPrev()
        }
      }
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true } }
  )

  // Auto-play (slide mode only)
  useEffect(() => {
    if (!isAutoPlaying || !isSlideMode || slideViewMemoId == null) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= totalSlides - 1) {
          setIsAutoPlaying(false)
          return prev
        }
        setTransitionClass('slide-enter-right')
        return prev + 1
      })
    }, autoPlayInterval * 1000)
    return () => clearInterval(timer)
  }, [isAutoPlaying, isSlideMode, autoPlayInterval, totalSlides, slideViewMemoId])

  // Stop auto-play when switching to scroll mode
  useEffect(() => {
    if (!isSlideMode) setIsAutoPlaying(false)
  }, [isSlideMode])

  // Controls auto-hide (slide mode only)
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    if (isSlideMode) {
      controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000)
    }
  }, [isSlideMode])

  useEffect(() => {
    if (slideViewMemoId == null) return
    // In scroll mode, always show controls
    if (!isSlideMode) {
      setControlsVisible(true)
      return
    }
    resetControlsTimer()
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [slideViewMemoId, isSlideMode, resetControlsTimer])

  const handleInteraction = useCallback(() => {
    if (isSlideMode) resetControlsTimer()
  }, [isSlideMode, resetControlsTimer])

  // Font size
  const adjustFontSize = (delta: number) => {
    setFontSize((prev) => Math.min(1.5, Math.max(0.8, +(prev + delta).toFixed(1))))
  }

  // Cycle auto-play interval
  const cycleAutoPlayInterval = () => {
    const idx = AUTO_PLAY_INTERVALS.indexOf(autoPlayInterval as typeof AUTO_PLAY_INTERVALS[number])
    setAutoPlayInterval(AUTO_PLAY_INTERVALS[(idx + 1) % AUTO_PLAY_INTERVALS.length])
  }

  // Toggle view mode
  const toggleViewMode = () => {
    setViewMode((v) => v === 'slide' ? 'scroll' : 'slide')
  }

  // Auto-close if memo is deleted or no longer exists
  useEffect(() => {
    if (slideViewMemoId != null && (!memo || memo.deletedAt)) {
      closeSlideView()
    }
  }, [slideViewMemoId, memo, closeSlideView])

  if (slideViewMemoId == null || !memo || memo.deletedAt) return null

  const isDark = slideTheme === 'dark'
  const currentSlide = slides[currentIndex]
  if (!currentSlide) return null

  const progressPercent = ((currentIndex + 1) / totalSlides) * 100

  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-[var(--z-lock)]',
        isClosing ? 'slide-overlay-exit' : 'slide-overlay-enter',
        !controlsVisible && isSlideMode && 'cursor-none',
        isDark && 'dark'
      )}
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
      onClick={handleInteraction}
      onAnimationEnd={(e) => {
        if (isClosing && e.target === e.currentTarget) {
          setIsClosing(false)
          closeSlideView()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="슬라이드 보기"
      data-theme="dark"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      {/* Content area */}
      {isSlideMode ? (
        /* === Slide mode: single slide with swipe === */
        <div
          className="slide-view-content relative w-full h-full flex items-center justify-center"
          {...bind()}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            key={currentIndex}
            className={clsx('w-full h-full max-w-5xl mx-auto', transitionClass)}
          >
            <SlideRenderer
              slide={currentSlide}
              fontSize={fontSize}
              isDarkTheme={isDark}
              createdAt={memo.createdAt}
              folderName={folderName}
            />
          </div>
        </div>
      ) : (
        /* === Scroll mode: all slides vertically === */
        <div className="slide-view-content slide-scroll-container relative">
          {slides.map((slide, i) => (
            <div key={i} className="slide-scroll-item">
              <SlideRenderer
                slide={slide}
                  fontSize={fontSize}
                isDarkTheme={isDark}
                createdAt={memo.createdAt}
                folderName={folderName}
              />
            </div>
          ))}
        </div>
      )}

      {/* Top controls */}
      <div
        className={clsx(
          'absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 transition-[opacity,transform] duration-200 ease-standard',
          'bg-gradient-to-b from-black/40 to-transparent',
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isSlideMode && currentSlide.heading && currentSlide.type === 'content' && (
            <span className="text-white/80 text-sm font-medium truncate max-w-[200px] lg:max-w-[400px]">
              {currentSlide.heading}
            </span>
          )}
          {!isSlideMode && (
            <span className="text-white/80 text-sm font-medium">
              {memo.title || '제목 없음'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* View mode toggle */}
          <button type="button"
            onClick={toggleViewMode}
            className="mw-button mw-button--tertiary-subtle mw-button--medium"
            title={isSlideMode ? '스크롤 보기' : '슬라이드 보기'}
            aria-label={isSlideMode ? '스크롤 보기' : '슬라이드 보기'}
          >
            {isSlideMode ? <IcMwList size={20} /> : <IcMwColumns size={20} />}
          </button>
          {/* Theme toggle */}
          <button type="button"
            onClick={() => setSlideTheme(isDark ? 'light' : 'dark')}
            className="mw-button mw-button--tertiary-subtle mw-button--medium"
            title={isDark ? '밝은 테마' : '어두운 테마'}
            aria-label={isDark ? '밝은 테마' : '어두운 테마'}
          >
            {isDark ? <IcMwSun size={20} /> : <IcMwMoon size={20} />}
          </button>
          {/* Font size */}
          <button type="button"
            onClick={() => adjustFontSize(-0.1)}
            className="mw-icon-button"
            title="글자 크기 줄이기"
            aria-label="글자 크기 줄이기"
            disabled={fontSize <= 0.8}
          >
            <IcLineMinus size={16} />
          </button>
          <span className="text-white/60 text-xs w-8 text-center tabular-nums">{Math.round(fontSize * 100)}%</span>
          <button type="button"
            onClick={() => adjustFontSize(0.1)}
            className="mw-icon-button"
            title="글자 크기 키우기"
            aria-label="글자 크기 키우기"
            disabled={fontSize >= 1.5}
          >
            <IcLineAdd size={16} />
          </button>
          {/* Close */}
          <button type="button"
            onClick={requestClose}
            className="mw-icon-button ml-1"
            title="닫기 (Esc)"
            aria-label="닫기"
          >
            <IcLineClose size={20} />
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 transition-[opacity,transform] duration-200 ease-standard',
          'bg-gradient-to-t from-black/40 to-transparent',
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        )}
      >
        {isSlideMode ? (
          /* Slide mode bottom: progress bar + auto-play */
          <>
            <div className="w-full h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-sm tabular-nums font-medium">
                {currentIndex + 1} / {totalSlides}
              </span>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={cycleAutoPlayInterval}
                  className="mw-button mw-button--tertiary-subtle mw-button--medium"
                  title="자동 재생 간격"
                  aria-label={`자동 재생 간격 ${autoPlayInterval}초`}
                >
                  {autoPlayInterval}초
                </button>
                <button type="button"
                  onClick={() => setIsAutoPlaying((prev) => !prev)}
                  className="mw-button mw-button--tertiary-subtle mw-button--medium"
                  title={isAutoPlaying ? '일시 정지' : '자동 재생'}
                  aria-label={isAutoPlaying ? '일시 정지' : '자동 재생'}
                >
                  {isAutoPlaying ? <IcLinePause size={20} /> : <IcFillPlay size={20} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Scroll mode bottom: total count */
          <div className="flex items-center justify-center">
            <span className="text-white/50 text-sm">
              {totalSlides}개 슬라이드
            </span>
          </div>
        )}
      </div>

      {/* Side navigation arrows (slide mode + desktop only) */}
      {isSlideMode && isDesktop && controlsVisible && (
        <>
          {currentIndex > 0 && (
            <button type="button"
              onClick={goPrev}
              className="mw-icon-button absolute left-4 top-1/2 -translate-y-1/2"
              title="이전 슬라이드"
              aria-label="이전 슬라이드"
            >
              <IcLineChevronLeft size={24} />
            </button>
          )}
          {currentIndex < totalSlides - 1 && (
            <button type="button"
              onClick={goNext}
              className="mw-icon-button absolute right-4 top-1/2 -translate-y-1/2"
              title="다음 슬라이드"
              aria-label="다음 슬라이드"
            >
              <IcLineChevronRight size={24} />
            </button>
          )}
        </>
      )}
    </div>,
    document.body
  )
}
