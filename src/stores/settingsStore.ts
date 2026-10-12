import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FontSize, InputStartPosition, Settings, UserProfile, STTLanguage, OCRProvider, EditorMode, GamificationState, LivingWorkspaceSettings, AIProvider } from '@/lib/types'
import { FONT_SIZES } from '@/utils/constants'

interface SettingsState {
  settings: Settings
  initialize: () => void
  setFontSize: (size: FontSize) => void
  setDefaultFolder: (folderId: number | null) => void
  setInputStartPosition: (pos: InputStartPosition) => void
  toggleHashtagToTag: () => void
  toggleLinkPreview: () => void
  setHasCompletedOnboarding: (completed: boolean) => void
  updateProfile: (profile: Partial<UserProfile>) => void
  setLastBackupDate: (date: Date) => void
  setOpenAIApiKey: (apiKey: string) => void
  setAnthropicApiKey: (apiKey: string) => void
  setGeminiApiKey: (apiKey: string) => void
  setAIProvider: (provider: AIProvider) => void
  setSTTLanguage: (language: STTLanguage) => void
  setOCRProvider: (provider: OCRProvider) => void
  setEditorMode: (mode: EditorMode) => void
  toggleAIAutocomplete: () => void
  toggleHighContrast: () => void
  updateGamification: (data: Partial<GamificationState>) => void
  updateLivingWorkspace: (data: Partial<LivingWorkspaceSettings>) => void
  updateAppLock: (data: Partial<Settings['appLock']>) => void
}

// 테마는 이 스토어의 일이 아니에요. 키트의 테마 엔진(public/theme-init.js, window.mwTheme)이 정하고 기기마다
// localStorage의 memo-theme에 기억해요. 화면은 src/mw/theme.ts의 useTheme()으로 읽고 바꿔요
// (https://ux.moonwave.kr/patterns/theme).

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
          geminiApiKey: '',
          aiProvider: 'anthropic',
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
          environmentThemeEnabled: true,
          survivalModeEnabled: false,
          completionEffectsEnabled: true,
          timeCapsuleEnabled: true,
          soundSyncEnabled: false,
          ambientImagesEnabled: false,
          worldBuildingEnabled: false,
          digitalGardenEnabled: false,
          breathingTypographyEnabled: false,
          ephemeralBrainDumpEnabled: false,
          timeMachineEnabled: false,
          contextSurfacingEnabled: false,
          organicAuraEnabled: false,
          ambientSoundscapeEnabled: false,
          semanticCanvasEnabled: false,
          alterEgoEnabled: false,
        },
        edgeLightingEnabled: true,
        appLock: {
          enabled: false,
          timeoutMinutes: 5,
        },
        notifications: {
          pushEnabled: false,
          dailyBriefing: true,
          weeklyDigest: true,
          timeCapsule: true,
        },
      },

      initialize: () => {
        const state = get()
        // 저장된 colorPalette · fontFamily는 읽지 않아요 (개인화 기능을 없앴어요. 값은 지우지 않아요)
        applyFontSize(state.settings.fontSize)
      },

      setFontSize: (size) => {
        set((state) => ({ settings: { ...state.settings, fontSize: size } }))
        applyFontSize(size)
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

      setGeminiApiKey: (apiKey) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, geminiApiKey: apiKey },
          },
        }))
      },

      setAIProvider: (provider) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ai: { ...state.settings.ai, aiProvider: provider },
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

      updateAppLock: (data) => {
        set((state) => ({
          settings: {
            ...state.settings,
            appLock: { ...state.settings.appLock, ...data },
          },
        }))
      },
    }),
    {
      name: 'memo-settings',
      version: 6,
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
              geminiApiKey: '',
              aiProvider: 'anthropic',
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
              environmentThemeEnabled: true,
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
        // v3→v4: add Beyond UX features to livingWorkspace
        if (version < 4 && state?.settings) {
          const lw = (state.settings.livingWorkspace ?? {}) as Record<string, unknown>
          if (lw.digitalGardenEnabled === undefined) lw.digitalGardenEnabled = false
          if (lw.breathingTypographyEnabled === undefined) lw.breathingTypographyEnabled = false
          if (lw.ephemeralBrainDumpEnabled === undefined) lw.ephemeralBrainDumpEnabled = false
          if (lw.timeMachineEnabled === undefined) lw.timeMachineEnabled = false
          if (lw.contextSurfacingEnabled === undefined) lw.contextSurfacingEnabled = false
          if (lw.organicAuraEnabled === undefined) lw.organicAuraEnabled = false
          if (lw.ambientSoundscapeEnabled === undefined) lw.ambientSoundscapeEnabled = false
          if (lw.semanticCanvasEnabled === undefined) lw.semanticCanvasEnabled = false
          if (lw.alterEgoEnabled === undefined) lw.alterEgoEnabled = false
          // Ensure new AI fields exist for existing users
          const ai = (state.settings.ai ?? {}) as Record<string, unknown>
          if (ai.geminiApiKey === undefined) ai.geminiApiKey = ''
          if (ai.aiProvider === undefined) ai.aiProvider = 'anthropic'
        }
        // v4→v5: 테마의 기본은 시스템 설정 따르기예요. 예전 기본값 'light'는 고른 값과 가를 수 없어 시스템으로 돌려요.
        if (version < 5 && state?.settings && state.settings.theme === 'light') {
          state.settings.theme = 'system'
        }
        // v5→v6: 테마는 키트의 테마 엔진이 기기마다 기억해요(localStorage의 memo-theme). 설정에 따로 들고 있던 값은
        // 더 읽지 않아요. 엔진이 모르는 고른 값(밝게 · 어둡게)만 한 번 넘겨주고, '시스템 설정 따르기'는 자동이 돼요.
        if (version < 6 && state?.settings && 'theme' in state.settings) {
          const chosen = state.settings.theme
          const engine = typeof window === 'undefined' ? undefined : window.mwTheme
          if ((chosen === 'light' || chosen === 'dark') && engine?.mode() === 'auto') engine.set(chosen)
          delete state.settings.theme
        }
        return state
      },
    }
  )
)
