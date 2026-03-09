import { useNavigate, useLocation } from 'react-router-dom'
import { Mic, Pencil, Camera, FileText, Flame } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'

export function FAB() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasApiKey = useSettingsStore((s) => !!s.settings.ai?.openaiApiKey || !!s.settings.ai?.anthropicApiKey)
  const ephemeralBrainDumpEnabled = useSettingsStore((s) => s.settings.livingWorkspace.ephemeralBrainDumpEnabled)

  // BUG-03: hide FAB on desktop when in editor view
  const isEditorRoute = /^\/memo\/\d+$/.test(location.pathname) || location.pathname === '/memo/new'

  const handleMicClick = () => {
    const apiKey = useSettingsStore.getState().settings.ai?.openaiApiKey
    if (!apiKey) {
      useToastStore.getState().showToast(
        'AI 서비스 설정에서 OpenAI API 키를 입력해 주세요',
        'warning',
        {
          action: {
            label: '설정',
            onClick: () => useUIStore.getState().openSettingsModal(),
          },
        }
      )
      return
    }
    useUIStore.getState().openVoiceModal()
  }

  const handleCameraClick = () => {
    const ai = useSettingsStore.getState().settings.ai
    const provider = ai?.ocrProvider || 'openai'
    const apiKey = provider === 'anthropic' ? ai?.anthropicApiKey : ai?.openaiApiKey
    if (!apiKey) {
      useToastStore.getState().showToast(
        `AI 서비스 설정에서 ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API 키를 입력해 주세요`,
        'warning',
        {
          action: {
            label: '설정',
            onClick: () => useUIStore.getState().openSettingsModal(),
          },
        }
      )
      return
    }
    useUIStore.getState().openImageOCRModal()
  }

  return (
    <div
      className={`fab-button fixed right-4 z-50 flex flex-col items-center gap-3 md:right-8 ${isEditorRoute ? 'lg:hidden' : ''}`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
    >
      {/* Voice memo + Image OCR — only when API key configured */}
      {hasApiKey && (
        <>
          <button
            onClick={handleMicClick}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-700 dark:text-zinc-300"
            aria-label="음성으로 메모 추가"
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            onClick={handleCameraClick}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-700 dark:text-zinc-300"
            aria-label="이미지에서 텍스트 추출"
          >
            <Camera className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Brain dump button */}
      {ephemeralBrainDumpEnabled && (
        <button
          onClick={() => navigate('/memo/new?ephemeral=true')}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-amber-900/40 dark:text-amber-400"
          aria-label="브레인 덤프"
        >
          <Flame className="h-5 w-5" />
        </button>
      )}

      {/* Template memo button */}
      <button
        onClick={() => useUIStore.getState().openTemplateModal()}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-700 dark:text-zinc-300"
        aria-label="템플릿으로 메모 작성"
      >
        <FileText className="h-5 w-5" />
      </button>

      {/* New memo button */}
      <button
        onClick={() => navigate('/memo/new')}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
        aria-label="새 메모 작성"
      >
        <Pencil className="h-6 w-6" />
      </button>
    </div>
  )
}
