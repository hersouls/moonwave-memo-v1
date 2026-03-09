import { useState, useEffect, useRef, useCallback } from 'react'
import { autocomplete } from '@/services/aiFeatures'
import { useSettingsStore } from '@/stores/settingsStore'

export function useAIAutocomplete(body: string, textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
  const [ghostText, setGhostText] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBodyRef = useRef('')
  const isEnabled = useSettingsStore((s) => s.settings.ai.aiAutocomplete)
  const hasApiKey = useSettingsStore((s) => !!s.settings.ai.openaiApiKey || !!s.settings.ai.anthropicApiKey)

  useEffect(() => {
    if (!isEnabled || !hasApiKey || !body.trim() || body.length < 10) {
      setGhostText('')
      return
    }

    // Only trigger if content has changed
    if (body === lastBodyRef.current) return
    lastBodyRef.current = body

    // Clear previous ghost text immediately
    setGhostText('')

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      const textarea = textareaRef.current
      if (!textarea) return

      // Get text up to cursor
      const cursorPos = textarea.selectionStart
      const cursorContext = body.slice(0, cursorPos)

      const result = await autocomplete(body, cursorContext)
      if (result.suggestion && body === lastBodyRef.current) {
        setGhostText(result.suggestion)
      }
    }, 1500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, isEnabled, hasApiKey])

  const acceptSuggestion = useCallback(() => {
    if (!ghostText) return false
    setGhostText('')
    return ghostText
  }, [ghostText])

  const dismissSuggestion = useCallback(() => {
    setGhostText('')
  }, [])

  return { ghostText, acceptSuggestion, dismissSuggestion }
}
