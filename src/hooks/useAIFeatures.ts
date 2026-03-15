import { useState, useEffect, useRef } from 'react'
import { suggestTags, isAIAvailable } from '@/services/aiFeatures'

export function useAITagSuggestions(content: string) {
  const [tags, setTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastContentRef = useRef('')

  useEffect(() => {
    if (!isAIAvailable() || !content.trim() || content.length < 20) {
      setTags([])
      return
    }

    // Only re-suggest if content changed significantly
    if (Math.abs(content.length - lastContentRef.current.length) < 30) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      lastContentRef.current = content
      setIsLoading(true)
      const result = await suggestTags(content)
      setTags(result.tags)
      setIsLoading(false)
    }, 5000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [content])

  return { tags, isLoading }
}
