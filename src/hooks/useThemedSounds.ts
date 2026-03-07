import { useRef, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useThemeOrchestrator } from '@/stores/themeOrchestratorStore'

type SoundType = 'key' | 'checkbox' | 'save'

function getSoundParams(palette: string | null, type: SoundType) {
  const isRain = palette === 'weather-rain'
  const isSnow = palette === 'weather-snow'
  const isClear = palette === 'weather-clear'
  const isMono = palette === 'monochrome'

  if (isMono) return null // Survival mode: mute all

  switch (type) {
    case 'key':
      if (isRain) return { freq: 300 + Math.random() * 200, dur: 0.1, vol: 0.02, wave: 'sine' as const }
      if (isClear) return { freq: 900 + Math.random() * 200, dur: 0.06, vol: 0.03, wave: 'sine' as const }
      if (isSnow) return { freq: 600 + Math.random() * 150, dur: 0.08, vol: 0.02, wave: 'triangle' as const }
      return { freq: 800 + Math.random() * 200, dur: 0.08, vol: 0.03, wave: 'sine' as const }

    case 'checkbox':
      if (isRain) return { freq: 400, dur: 0.15, vol: 0.04, wave: 'sine' as const }
      if (isClear) return { freq: 1000, dur: 0.1, vol: 0.04, wave: 'sine' as const }
      return { freq: 700, dur: 0.12, vol: 0.04, wave: 'sine' as const }

    case 'save':
      if (isRain) return { freq: 500, dur: 0.2, vol: 0.04, wave: 'sine' as const }
      if (isClear) return { freq: 1100, dur: 0.15, vol: 0.04, wave: 'triangle' as const }
      return { freq: 880, dur: 0.15, vol: 0.04, wave: 'sine' as const }
  }
}

export function useThemedSounds() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playSound = useCallback((type: SoundType) => {
    const enabled = useSettingsStore.getState().settings.livingWorkspace.soundSyncEnabled
    if (!enabled) return

    const palette = useThemeOrchestrator.getState().activePalette
    const params = getSoundParams(palette, type)
    if (!params) return

    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = params.freq
      osc.type = params.wave
      gain.gain.value = params.vol
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + params.dur)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + params.dur)
    } catch {
      /* ignore audio errors */
    }
  }, [])

  return {
    playKeySound: useCallback(() => playSound('key'), [playSound]),
    playCheckboxSound: useCallback(() => playSound('checkbox'), [playSound]),
    playSaveSound: useCallback(() => playSound('save'), [playSound]),
  }
}
