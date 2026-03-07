import { useEffect, useRef } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useThemeOrchestrator } from '@/stores/themeOrchestratorStore'

const DRAFT_THRESHOLD = 5
const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const CHECK_INTERVAL_MS = 30_000

export function useCognitiveLoadDetector() {
  const setSurvivalMode = useThemeOrchestrator((s) => s.setSurvivalMode)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = () => {
      const enabled = useSettingsStore.getState().settings.livingWorkspace.survivalModeEnabled
      if (!enabled) {
        setSurvivalMode(false)
        return
      }

      const memos = useMemoStore.getState().memos
      const now = Date.now()
      const cutoff = new Date(now - TWO_HOURS_MS).toISOString()

      // Count recently-updated unsaved drafts (updated recently, not starred, not deleted)
      const recentDrafts = memos.filter(
        (m) => !m.deletedAt && !m.isStarred && m.updatedAt > cutoff
      )

      const overloaded = recentDrafts.length >= DRAFT_THRESHOLD

      setSurvivalMode(overloaded)
    }

    check()
    timerRef.current = setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setSurvivalMode(false)
    }
  }, [setSurvivalMode])
}
