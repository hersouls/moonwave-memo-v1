import { useEffect, useRef } from 'react'
import { analyzeSentiment } from '@/services/sentimentAnalysis'

export function useOrganicAura(body: string, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      // Clean up aura if disabled
      document.documentElement.removeAttribute('data-aura')
      document.documentElement.style.removeProperty('--aura-hue')
      document.documentElement.style.removeProperty('--aura-saturation')
      return
    }

    // Set data-aura attribute when enabled
    document.documentElement.setAttribute('data-aura', '')

    // Debounce sentiment analysis by 2 seconds
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      if (!body.trim()) {
        document.documentElement.style.setProperty('--aura-saturation', '0')
        return
      }

      const mood = analyzeSentiment(body)

      switch (mood) {
        case 'positive':
          document.documentElement.style.setProperty('--aura-hue', '80')
          document.documentElement.style.setProperty('--aura-saturation', '0.08')
          break
        case 'negative':
          document.documentElement.style.setProperty('--aura-hue', '280')
          document.documentElement.style.setProperty('--aura-saturation', '0.06')
          break
        case 'neutral':
        default:
          document.documentElement.style.setProperty('--aura-saturation', '0')
          break
      }
    }, 2000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [body, enabled])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute('data-aura')
      document.documentElement.style.removeProperty('--aura-hue')
      document.documentElement.style.removeProperty('--aura-saturation')
    }
  }, [])
}
