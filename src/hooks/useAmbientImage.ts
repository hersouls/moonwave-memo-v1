import { useState, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useThemeOrchestrator } from '@/stores/themeOrchestratorStore'
import { useWritingAnalytics } from './useWritingAnalytics'
import { getAmbientImage } from '@/services/database'
import { generateAmbientImage, generateWorldBuildingImage } from '@/services/ambientImageService'
import type { AmbientImage, WeatherCondition } from '@/lib/types'

export function useAmbientImage() {
  const [ambientImage, setAmbientImage] = useState<AmbientImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lw = useSettingsStore((s) => s.settings.livingWorkspace)
  const hasApiKey = useSettingsStore((s) => !!s.settings.ai.openaiApiKey)
  const activeSource = useThemeOrchestrator((s) => s.activeSource)
  const signals = useThemeOrchestrator((s) => s.signals)

  useEffect(() => {
    if (!lw.ambientImagesEnabled || !hasApiKey) return

    let cancelled = false

    const load = async () => {
      // Try cache first
      const cached = await getAmbientImage('ambient')
      if (cached && !cancelled) {
        setAmbientImage(cached)
        return
      }

      setIsLoading(true)
      const weather = (activeSource === 'environment' ? signals.environment.weather : null) as WeatherCondition | null
      const image = await generateAmbientImage(weather)
      if (!cancelled) {
        setAmbientImage(image)
        setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [lw.ambientImagesEnabled, hasApiKey, activeSource, signals.environment.weather])

  return { ambientImage, isLoading }
}

export function useWorldBuildingImage() {
  const [worldImage, setWorldImage] = useState<AmbientImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lw = useSettingsStore((s) => s.settings.livingWorkspace)
  const hasApiKey = useSettingsStore((s) => !!s.settings.ai.openaiApiKey)
  const { topTags, totalWords } = useWritingAnalytics()

  useEffect(() => {
    if (!lw.worldBuildingEnabled || !hasApiKey || topTags.length === 0) return

    let cancelled = false

    const load = async () => {
      // Try cache first
      const cached = await getAmbientImage('world-building')
      if (cached && !cancelled) {
        setWorldImage(cached)
        return
      }

      setIsLoading(true)
      const image = await generateWorldBuildingImage(topTags, totalWords)
      if (!cancelled) {
        setWorldImage(image)
        setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [lw.worldBuildingEnabled, hasApiKey, topTags, totalWords])

  return { worldImage, isLoading }
}
