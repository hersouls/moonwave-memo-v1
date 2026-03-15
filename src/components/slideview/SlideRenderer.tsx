import { memo } from 'react'
import type { Slide } from './useSlideParser'
import type { MemoColor } from '@/lib/types'
import { MarkdownPreview } from '@/components/editor/MarkdownPreview'
import { formatFullDate } from '@/utils/format'

const SLIDE_GRADIENTS: Record<MemoColor, { light: string; dark: string }> = {
  white:  { light: 'linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%)', dark: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)' },
  yellow: { light: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)', dark: 'linear-gradient(135deg, #422006 0%, #78350f 100%)' },
  green:  { light: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', dark: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)' },
  blue:   { light: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', dark: 'linear-gradient(135deg, #172554 0%, #1e3a5f 100%)' },
  pink:   { light: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', dark: 'linear-gradient(135deg, #500724 0%, #831843 100%)' },
  purple: { light: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', dark: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)' },
}

interface SlideRendererProps {
  slide: Slide
  memoColor: MemoColor
  fontSize: number
  isDarkTheme: boolean
  createdAt?: string
  folderName?: string | null
}

export const SlideRenderer = memo(function SlideRenderer({
  slide,
  memoColor,
  fontSize,
  isDarkTheme,
  createdAt,
  folderName,
}: SlideRendererProps) {
  const gradients = SLIDE_GRADIENTS[memoColor] || SLIDE_GRADIENTS.white
  const bg = isDarkTheme ? gradients.dark : gradients.light

  if (slide.type === 'cover') {
    return (
      <div
        className="slide-renderer w-full h-full flex flex-col items-center justify-center px-8 py-12 text-center"
        style={{
          background: bg,
          '--slide-font-scale': fontSize,
        } as React.CSSProperties}
      >
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-8"
          style={{
            fontSize: `calc(2.5rem * ${fontSize})`,
            color: isDarkTheme ? '#f4f4f5' : '#18181b',
          }}
        >
          {slide.heading || '제목 없음'}
        </h1>
        {createdAt && (
          <p
            className="text-lg mb-4"
            style={{ color: isDarkTheme ? '#a1a1aa' : '#71717a' }}
          >
            {formatFullDate(createdAt)}
          </p>
        )}
        {folderName && (
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              color: isDarkTheme ? '#d4d4d8' : '#52525b',
            }}
          >
            {folderName}
          </span>
        )}
      </div>
    )
  }

  // Content slide
  return (
    <div
      className="slide-renderer w-full h-full flex flex-col px-8 py-10 lg:px-16 lg:py-14 overflow-y-auto"
      style={{
        background: bg,
        '--slide-font-scale': fontSize,
      } as React.CSSProperties}
    >
      {slide.heading && (
        <h2
          className="font-bold mb-8 leading-tight"
          style={{
            fontSize: `calc(${slide.headingLevel === 1 ? '2.25rem' : '1.75rem'} * ${fontSize})`,
            color: isDarkTheme ? '#f4f4f5' : '#18181b',
          }}
        >
          {slide.heading}
        </h2>
      )}
      <div
        className="slide-markdown-content flex-1"
        style={{
          fontSize: `calc(1.125rem * ${fontSize})`,
          color: isDarkTheme ? '#d4d4d8' : '#3f3f46',
          lineHeight: 1.8,
        }}
      >
        <MarkdownPreview content={slide.content} />
      </div>
    </div>
  )
})
