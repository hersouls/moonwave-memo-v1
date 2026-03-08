import { create } from 'zustand'
import type { ThemeSource, WeatherCondition } from '@/lib/types'
import { useSettingsStore, applyTheme, applyColorPalette } from './settingsStore'

type ExtendedPalette =
  | 'default' | 'ocean' | 'rose' | 'purple' | 'forest'
  | 'monochrome' | 'victory-gold'
  | 'weather-clear' | 'weather-rain' | 'weather-snow' | 'weather-overcast'

interface ThemeSignals {
  manualOverride: { active: boolean; palette: ExtendedPalette | null }
  survival: { active: boolean }
  specialEvent: { active: boolean; type: 'anniversary' | 'milestone' | null; memoTitle?: string }
  environment: { weather: WeatherCondition | null; temperature: number | null; solarMode: 'light' | 'dark' | null }
}

interface ThemeOrchestratorState {
  activeSource: ThemeSource
  activePalette: ExtendedPalette | null
  signals: ThemeSignals

  setManualOverride: (palette: ExtendedPalette | null) => void
  clearManualOverride: () => void
  setSurvivalMode: (active: boolean) => void
  setSpecialEvent: (event: { type: 'anniversary' | 'milestone'; memoTitle?: string } | null) => void
  setEnvironment: (weather: WeatherCondition | null, temperature: number | null, solarMode: 'light' | 'dark' | null) => void
  resolve: () => void
}

function weatherToPalette(weather: WeatherCondition): ExtendedPalette {
  switch (weather) {
    case 'clear': return 'weather-clear'
    case 'rain': return 'weather-rain'
    case 'snow': return 'weather-snow'
    case 'overcast': return 'weather-overcast'
  }
}

export const useThemeOrchestrator = create<ThemeOrchestratorState>()((set, get) => ({
  activeSource: 'default',
  activePalette: null,
  signals: {
    manualOverride: { active: false, palette: null },
    survival: { active: false },
    specialEvent: { active: false, type: null },
    environment: { weather: null, temperature: null, solarMode: null },
  },

  setManualOverride: (palette) => {
    set((s) => ({
      signals: { ...s.signals, manualOverride: { active: palette !== null, palette } },
    }))
    get().resolve()
  },

  clearManualOverride: () => {
    set((s) => ({
      signals: { ...s.signals, manualOverride: { active: false, palette: null } },
    }))
    get().resolve()
  },

  setSurvivalMode: (active) => {
    set((s) => ({
      signals: { ...s.signals, survival: { active } },
    }))
    get().resolve()
  },

  setSpecialEvent: (event) => {
    set((s) => ({
      signals: {
        ...s.signals,
        specialEvent: event
          ? { active: true, type: event.type, memoTitle: event.memoTitle }
          : { active: false, type: null },
      },
    }))
    get().resolve()
  },

  setEnvironment: (weather, temperature, solarMode) => {
    set((s) => ({
      signals: { ...s.signals, environment: { weather, temperature, solarMode } },
    }))
    get().resolve()
  },

  resolve: () => {
    const { signals } = get()
    const lw = useSettingsStore.getState().settings.livingWorkspace
    const settings = useSettingsStore.getState().settings

    let source: ThemeSource = 'default'
    let palette: ExtendedPalette | null = null

    // Priority 1: Manual Override
    if (signals.manualOverride.active && signals.manualOverride.palette) {
      source = 'manual-override'
      palette = signals.manualOverride.palette
    }
    // Priority 2: Survival Mode
    else if (lw.survivalModeEnabled && signals.survival.active) {
      source = 'survival'
      palette = 'monochrome'
    }
    // Priority 3: Special Event
    else if (lw.timeCapsuleEnabled && signals.specialEvent.active) {
      source = 'special-event'
      palette = 'victory-gold'
    }
    // Priority 4: Environment
    else if (lw.environmentThemeEnabled && signals.environment.weather) {
      source = 'environment'
      palette = weatherToPalette(signals.environment.weather)
    }
    // Priority 5: Default
    else {
      source = 'default'
      palette = null
    }

    set({ activeSource: source, activePalette: palette })

    // Apply palette (null = use user's default from settingsStore)
    if (palette) {
      applyColorPalette(palette as never)
    } else {
      applyColorPalette(settings.colorPalette)
    }

    // Apply solar dark mode if environment is active and no higher priority overrides theme mode
    if (source === 'environment' && signals.environment.solarMode && lw.environmentThemeEnabled) {
      applyTheme(signals.environment.solarMode)
    } else if (source === 'default') {
      applyTheme(settings.theme)
    }
  },
}))
