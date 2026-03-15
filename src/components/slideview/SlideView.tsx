import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDrag } from '@use-gesture/react'
import {
  X, ChevronLeft, ChevronRight, Play, Pause,
  Sun, Moon, Minus, Plus,
  GalleryHorizontal, GalleryVertical,
} from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSlideParser } from './useSlideParser'
import { SlideRenderer } from './SlideRenderer'

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
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const isSlideMode = viewMode === 'slide'

  // Reset state when memo changes
  useEffect(() => {
    setCurrentIndex(0)
    setTransitionClass('slide-fade-in')
    setIsAutoPlaying(false)
    setViewMode('scroll')

    const isDark = document.documentElement.classList.contains('dark')
    setSlideTheme(isDark ? 'dark' : 'light')
  }, [slideViewMemoId])

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
        closeSlideView()
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
  }, [slideViewMemoId, isSlideMode, goNext, goPrev, goTo, closeSlideView, totalSlides])

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

  const progressPercent = totalSlides > 1 ? ((currentIndex) / (totalSlides - 1)) * 100 : 100

  return createPortal(
    <div
      className={clsx('fixed inset-0 z-[100] slide-overlay-enter', isDark && 'dark')}
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
      onClick={handleInteraction}
      role="dialog"
      aria-modal="true"
      aria-label="슬라이드 보기"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      {/* Content area */}
      {isSlideMode ? (
        /* === Slide mode: single slide with swipe === */
        <div
          className="relative w-full h-full flex items-center justify-center"
          {...bind()}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            key={currentIndex}
            className={clsx('w-full h-full max-w-5xl mx-auto', transitionClass)}
          >
            <SlideRenderer
              slide={currentSlide}
              memoColor={memo.color}
              fontSize={fontSize}
              isDarkTheme={isDark}
              createdAt={memo.createdAt}
              folderName={folderName}
            />
          </div>
        </div>
      ) : (
        /* === Scroll mode: all slides vertically === */
        <div className="slide-scroll-container relative">
          {slides.map((slide, i) => (
            <div key={i} className="slide-scroll-item">
              <SlideRenderer
                slide={slide}
                memoColor={memo.color}
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
          'absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 transition-opacity duration-200',
          'bg-gradient-to-b from-black/40 to-transparent',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
          <button
            onClick={toggleViewMode}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isSlideMode ? '스크롤 보기' : '슬라이드 보기'}
          >
            {isSlideMode ? <GalleryVertical className="w-4.5 h-4.5" /> : <GalleryHorizontal className="w-4.5 h-4.5" />}
          </button>
          {/* Theme toggle */}
          <button
            onClick={() => setSlideTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isDark ? '라이트 테마' : '다크 테마'}
          >
            {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
          {/* Font size */}
          <button
            onClick={() => adjustFontSize(-0.1)}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="글자 크기 줄이기"
            disabled={fontSize <= 0.8}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-xs w-8 text-center tabular-nums">{Math.round(fontSize * 100)}%</span>
          <button
            onClick={() => adjustFontSize(0.1)}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="글자 크기 키우기"
            disabled={fontSize >= 1.5}
          >
            <Plus className="w-4 h-4" />
          </button>
          {/* Close */}
          <button
            onClick={closeSlideView}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors ml-1"
            title="닫기 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 transition-opacity duration-200',
          'bg-gradient-to-t from-black/40 to-transparent',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
                <button
                  onClick={cycleAutoPlayInterval}
                  className="px-2 py-1 rounded-md text-white/60 hover:text-white text-xs tabular-nums hover:bg-white/10 transition-colors"
                  title="자동 재생 간격"
                >
                  {autoPlayInterval}초
                </button>
                <button
                  onClick={() => setIsAutoPlaying((prev) => !prev)}
                  className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title={isAutoPlaying ? '일시 정지' : '자동 재생'}
                >
                  {isAutoPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
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
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 text-white/70 hover:text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
              title="이전 슬라이드"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {currentIndex < totalSlides - 1 && (
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 text-white/70 hover:text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
              title="다음 슬라이드"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </>
      )}
    </div>,
    document.body
  )
}
