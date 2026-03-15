import { useMemo } from 'react'

export interface Slide {
  type: 'cover' | 'content'
  heading?: string
  headingLevel?: number
  content: string
}

const LINES_PER_SLIDE = 15
const HEADING_REGEX = /^(#{1,2})\s+(.+)/

export function useSlideParser(
  body: string,
  title: string,
  createdAt: string,
  folderName: string | null
) {
  const slides = useMemo(() => {
    const result: Slide[] = []

    // Cover slide
    result.push({
      type: 'cover',
      heading: title,
      content: [
        title,
        createdAt,
        folderName || '',
      ].filter(Boolean).join('\n'),
    })

    if (!body.trim()) return result

    const lines = body.split('\n')

    // Check if any heading exists
    const hasHeadings = lines.some((line) => HEADING_REGEX.test(line))

    if (hasHeadings) {
      // Split by # or ## headings — collect lines in arrays then join (avoids O(n²) string concat)
      let currentHeading: { heading: string; level: number } | null = null
      let contentLines: string[] = []

      const flushSlide = () => {
        const content = contentLines.join('\n').trim()
        if (content || currentHeading) {
          result.push({
            type: 'content',
            heading: currentHeading?.heading,
            headingLevel: currentHeading?.level,
            content,
          })
        }
        contentLines = []
        currentHeading = null
      }

      for (const line of lines) {
        const match = line.match(HEADING_REGEX)
        if (match) {
          // Flush previous slide
          if (currentHeading || contentLines.length > 0) flushSlide()
          currentHeading = {
            heading: match[2].replace(/[*_`~[\]]/g, '').trim(),
            level: match[1].length,
          }
        } else {
          contentLines.push(line)
        }
      }

      // Flush last slide
      if (currentHeading || contentLines.length > 0) flushSlide()
    } else {
      // No headings: split by line count
      for (let i = 0; i < lines.length; i += LINES_PER_SLIDE) {
        const chunk = lines.slice(i, i + LINES_PER_SLIDE).join('\n').trim()
        if (chunk) {
          result.push({
            type: 'content',
            content: chunk,
          })
        }
      }
    }

    return result
  }, [body, title, createdAt, folderName])

  return { slides, totalSlides: slides.length }
}
