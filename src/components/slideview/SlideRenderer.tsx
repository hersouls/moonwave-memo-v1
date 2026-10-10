import { memo } from 'react'
import type { Slide } from './useSlideParser'
import { MarkdownPreview } from '@/components/editor/MarkdownPreview'
import { formatFullDate } from '@/utils/format'

interface SlideRendererProps {
  slide: Slide
  fontSize: number
  isDarkTheme: boolean
  createdAt?: string
  folderName?: string | null
}

export const SlideRenderer = memo(function SlideRenderer({
  slide,
  fontSize,
  isDarkTheme,
  createdAt,
  folderName,
}: SlideRendererProps) {
  // 슬라이드는 앱의 테마와 따로 밝기를 고를 수 있어요. 감싼 요소의 data-theme으로 토큰을 다시 풀어요.
  const theme = isDarkTheme ? 'dark' : 'light'

  if (slide.type === 'cover') {
    return (
      <div
        className="slide-renderer w-full h-full flex flex-col items-center justify-center px-8 py-12 text-center"
        data-theme={theme}
        style={{
          background: 'var(--background-secondary)',
          '--slide-font-scale': fontSize,
        } as React.CSSProperties}
      >
        <h1
          className="font-bold leading-tight tracking-[-0.02em] text-balance mb-8"
          style={{
            // 뷰포트에 따라 36px~60px로 스케일 + 사용자 글자 크기 컨트롤 반영
            fontSize: `calc(clamp(2.25rem, 1.2rem + 3.5vw, 3.75rem) * ${fontSize})`,
            color: 'var(--text-primary)',
          }}
        >
          {slide.heading || '제목 없음'}
        </h1>
        {createdAt && (
          <p
            className="text-lg mb-4"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {formatFullDate(createdAt)}
          </p>
        )}
        {folderName && (
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'var(--fill-secondary-default)',
              color: 'var(--text-secondary)',
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
      data-theme={theme}
      style={{
        background: 'var(--background-secondary)',
        '--slide-font-scale': fontSize,
      } as React.CSSProperties}
    >
      {slide.heading && (
        <h2
          className="font-bold mb-8 leading-tight tracking-[-0.015em]"
          style={{
            fontSize: `calc(${slide.headingLevel === 1 ? '2.25rem' : '1.75rem'} * ${fontSize})`,
            color: 'var(--text-primary)',
          }}
        >
          {slide.heading}
        </h2>
      )}
      <div
        className="slide-markdown-content flex-1"
        style={{
          fontSize: `calc(var(--font-size-18) * ${fontSize})`,
          color: 'var(--text-secondary)',
          lineHeight: 1.8,
        }}
      >
        <MarkdownPreview content={slide.content} />
      </div>
    </div>
  )
})
