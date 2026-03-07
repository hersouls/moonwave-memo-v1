import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode, ColorPalette, FontFamily, FontSize, MemoColor, InputStartPosition, Settings, UserProfile, STTLanguage, OCRProvider, EditorMode, GamificationState, LivingWorkspaceSettings } from '@/lib/types'
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
  setOpenAIApiKey: (apiKey: string) => void
  setAnthropicApiKey: (apiKey: string) => void
  setSTTLanguage: (language: STTLanguage) => void
  setOCRProvider: (provider: OCRProvider) => void
  setEditorMode: (mode: EditorMode) => void
  toggleAIAutocomplete: () => void
  toggleHighContrast: () => void
  updateGamification: (data: Partial<GamificationState>) => void
  updateLivingWorkspace: (data: Partial<LivingWorkspaceSettings>) => void
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
          editorMode: 'tabs',
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
          openaiApiKey: '',
          anthropicApiKey: '',
          whisperModel: 'whisper-1',
          language: 'ko',
          ocrProvider: 'openai',
          aiAutocomplete: false,
        },
        highContrastMode: false,
        gamification: {
          currentStreak: 0,
          longestStreak: 0,
          totalMemosCreated: 0,
          lastActiveDate: '',
          badges: [],
        },
        livingWorkspace: {
          environmentThemeEnabled: false,
          survivalModeEnabled: false,
          completionEffectsEnabled: true,
          timeCapsuleEnabled: true,
          soundSyncEnabled: false,
          ambientImagesEnabled: false,
          worldBuildingEnabled: false,
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

      setOpenAIApiKey: (apiKey) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, openaiApiKey: apiKey },
          },
        }))
      },

      setAnthropicApiKey: (apiKey) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, anthropicApiKey: apiKey },
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

      setOCRProvider: (provider) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, ocrProvider: provider },
          },
        }))
      },

      setEditorMode: (mode) => {
        set((state) => ({
          settings: {
            ...state.settings,
            memoSettings: { ...state.settings.memoSettings, editorMode: mode },
          },
        }))
      },

      toggleAIAutocomplete: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, aiAutocomplete: !state.settings.ai.aiAutocomplete },
          },
        }))
      },

      toggleHighContrast: () => {
        set((state) => {
          const next = !state.settings.highContrastMode
          document.documentElement.toggleAttribute('data-high-contrast', next)
          return { settings: { ...state.settings, highContrastMode: next } }
        })
      },

      updateGamification: (data) => {
        set((state) => ({
          settings: {
            ...state.settings,
            gamification: { ...state.settings.gamification, ...data },
          },
        }))
      },

      updateLivingWorkspace: (data) => {
        set((state) => ({
          settings: {
            ...state.settings,
            livingWorkspace: { ...state.settings.livingWorkspace, ...data },
          },
        }))
      },
    }),
    {
      name: 'memo-settings',
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as { settings: Record<string, unknown> & { ai?: Record<string, unknown> } }
        if (version < 1 && state?.settings?.ai) {
          const ai = state.settings.ai
          if ('apiKey' in ai && !('openaiApiKey' in ai)) {
            const oldKey = (ai.apiKey as string) || ''
            const oldProvider = (ai.provider as string) || 'openai'
            state.settings.ai = {
              openaiApiKey: oldProvider === 'openai' ? oldKey : '',
              anthropicApiKey: oldProvider === 'anthropic' ? oldKey : '',
              whisperModel: 'whisper-1',
              language: (ai.language as string) || 'ko',
              ocrProvider: 'openai',
              aiAutocomplete: false,
            }
          }
        }
        // v1→v2: add gamification + highContrastMode + editorMode
        if (version < 2 && state?.settings) {
          if (!state.settings.gamification) {
            state.settings.gamification = {
              currentStreak: 0,
              longestStreak: 0,
              totalMemosCreated: 0,
              lastActiveDate: '',
              badges: [],
            }
          }
          if (state.settings.highContrastMode === undefined) {
            state.settings.highContrastMode = false
          }
          const memo = state.settings.memoSettings as Record<string, unknown> | undefined
          if (memo && memo.editorMode === undefined) {
            memo.editorMode = 'tabs'
          }
          const ai = state.settings.ai as Record<string, unknown> | undefined
          if (ai && ai.aiAutocomplete === undefined) {
            ai.aiAutocomplete = false
          }
        }
        // v2→v3: add livingWorkspace settings
        if (version < 3 && state?.settings) {
          if (!state.settings.livingWorkspace) {
            state.settings.livingWorkspace = {
              environmentThemeEnabled: false,
              survivalModeEnabled: false,
              completionEffectsEnabled: true,
              timeCapsuleEnabled: true,
              soundSyncEnabled: false,
              ambientImagesEnabled: false,
              worldBuildingEnabled: false,
            }
          }
          const lw = state.settings.livingWorkspace as Record<string, unknown>
          if (lw.ambientImagesEnabled === undefined) lw.ambientImagesEnabled = false
          if (lw.worldBuildingEnabled === undefined) lw.worldBuildingEnabled = false
        }
        return state
      },
    }
  )
)
