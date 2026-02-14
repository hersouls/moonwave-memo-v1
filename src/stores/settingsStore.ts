import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode, ColorPalette, FontFamily, FontSize, MemoColor, InputStartPosition, Settings, UserProfile, AIProvider, STTLanguage } from '@/lib/types'
import { FONT_FAMILIES, FONT_SIZES } from '@/utils/constants'

interface SettingsState {
  settings: Settings
  initialize: () => void
  setTheme: (theme: ThemeMode) => void
  setColorPalette: (palette: ColorPalette) => void
  setFontFamily: (font: FontFamily) => void
  setFontSize: (size: FontSize) => void
  setDefaultColor: (color: MemoColor) => void
  setDefaultFolder: (folderId: number | null) => void
  setInputStartPosition: (pos: InputStartPosition) => void
  toggleHashtagToTag: () => void
  toggleLinkPreview: () => void
  setHasCompletedOnboarding: (completed: boolean) => void
  updateProfile: (profile: Partial<UserProfile>) => void
  setLastBackupDate: (date: Date) => void
  setAIProvider: (provider: AIProvider) => void
  setAPIKey: (apiKey: string) => void
  setSTTLanguage: (language: STTLanguage) => void
}

export function applyTheme(theme: ThemeMode) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export function applyColorPalette(palette: ColorPalette) {
  const root = document.documentElement
  if (palette === 'default') {
    root.removeAttribute('data-palette')
  } else {
    root.setAttribute('data-palette', palette)
  }
}

export function applyFontFamily(fontId: FontFamily) {
  const fontDef = FONT_FAMILIES.find((f) => f.id === fontId)
  if (fontDef) {
    document.documentElement.style.setProperty('--memo-font-family', fontDef.fontFamily)
  }
}

export function applyFontSize(sizeId: FontSize) {
  const sizeDef = FONT_SIZES.find((s) => s.id === sizeId)
  if (sizeDef) {
    document.documentElement.style.setProperty('--memo-font-scale', String(sizeDef.scale))
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: {
        theme: 'light',
        colorPalette: 'default',
        fontFamily: 'pretendard',
        fontSize: 'md',
        memoSettings: {
          defaultColor: 'white',
          defaultFolderId: null,
          inputStartPosition: 'body',
          hashtagToTag: true,
          linkPreview: true,
        },
        hasCompletedOnboarding: false,
        userProfile: {
          name: '사용자',
        },
        googleDrive: {
          isConnected: false,
          autoBackup: false,
        },
        ai: {
          provider: 'openai',
          apiKey: '',
          whisperModel: 'whisper-1',
          language: 'ko',
        },
      },

      initialize: () => {
        const state = get()
        const { theme, colorPalette, fontFamily, fontSize } = state.settings
        applyTheme(theme)
        applyColorPalette(colorPalette)
        applyFontFamily(fontFamily)
        applyFontSize(fontSize)

        window
          .matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', () => {
            if (get().settings.theme === 'system') {
              applyTheme('system')
            }
          })
      },

      setTheme: (theme) => {
        set((state) => ({ settings: { ...state.settings, theme } }))
        applyTheme(theme)
      },

      setColorPalette: (palette) => {
        set((state) => ({ settings: { ...state.settings, colorPalette: palette } }))
        applyColorPalette(palette)
      },

      setFontFamily: (font) => {
        set((state) => ({ settings: { ...state.settings, fontFamily: font } }))
        applyFontFamily(font)
      },

      setFontSize: (size) => {
        set((state) => ({ settings: { ...state.settings, fontSize: size } }))
        applyFontSize(size)
      },

      setDefaultColor: (color) => {
        set((state) => ({
          settings: {
            ...state.settings,
            memoSettings: { ...state.settings.memoSettings, defaultColor: color },
          },
        }))
      },

      setDefaultFolder: (folderId) => {
        set((state) => ({
          settings: {
            ...state.settings,
            memoSettings: { ...state.settings.memoSettings, defaultFolderId: folderId },
          },
        }))
      },

      setInputStartPosition: (pos) => {
        set((state) => ({
          settings: {
            ...state.settings,
            memoSettings: { ...state.settings.memoSettings, inputStartPosition: pos },
          },
        }))
      },

      toggleHashtagToTag: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            memoSettings: {
              ...state.settings.memoSettings,
              hashtagToTag: !state.settings.memoSettings.hashtagToTag,
            },
          },
        }))
      },

      toggleLinkPreview: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            memoSettings: {
              ...state.settings.memoSettings,
              linkPreview: !state.settings.memoSettings.linkPreview,
            },
          },
        }))
      },

      setHasCompletedOnboarding: (completed) => {
        set((state) => ({
          settings: { ...state.settings, hasCompletedOnboarding: completed },
        }))
      },

      updateProfile: (profile) => {
        set((state) => ({
          settings: {
            ...state.settings,
            userProfile: { ...state.settings.userProfile, ...profile },
          },
        }))
      },

      setLastBackupDate: (date) => {
        set((state) => ({
          settings: { ...state.settings, lastBackupDate: date.toISOString() },
        }))
      },

      setAIProvider: (provider) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, provider },
          },
        }))
      },

      setAPIKey: (apiKey) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, apiKey },
          },
        }))
      },

      setSTTLanguage: (language) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, language },
          },
        }))
      },
    }),
    { name: 'memo-settings' }
  )
)
