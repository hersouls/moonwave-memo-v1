import { useNavigate } from 'react-router-dom'
import { Mic, Pencil } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'

export function FAB() {
  const navigate = useNavigate()

  const handleMicClick = () => {
    const apiKey = useSettingsStore.getState().settings.ai?.apiKey
    if (!apiKey) {
      useToastStore.getState().showToast(
        'AI 설정에서 API 키를 입력해 주세요',
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

  return (
    <div className="fab-button fixed bottom-24 right-4 z-40 flex flex-col items-center gap-3 md:bottom-8 md:right-8">
      {/* Voice memo button */}
      <button
        onClick={handleMicClick}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-700 dark:text-zinc-300"
        aria-label="음성으로 메모 추가"
      >
        <Mic className="h-5 w-5" />
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
