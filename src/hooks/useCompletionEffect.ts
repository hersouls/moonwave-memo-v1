import { useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

const CATHARSIS_TAGS = ['아이디어', '회고', '일기', '리뷰']
const MIN_CONTENT_LENGTH = 500

export function useCompletionEffect() {
  const trigger = useCallback((body: string, tags: string[]) => {
    const enabled = useSettingsStore.getState().settings.livingWorkspace.completionEffectsEnabled
    if (!enabled) return

    const isLongMemo = body.length >= MIN_CONTENT_LENGTH
    const hasSpecialTag = tags.some((t) => CATHARSIS_TAGS.includes(t))

    if (!isLongMemo && !hasSpecialTag) return

    const root = document.documentElement
    if (root.classList.contains('completion-catharsis')) return

    root.classList.add('completion-catharsis')
    setTimeout(() => root.classList.remove('completion-catharsis'), 1500)
  }, [])

  return { triggerCompletionEffect: trigger }
}
