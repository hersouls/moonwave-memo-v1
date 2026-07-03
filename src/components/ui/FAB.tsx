import { useNavigate, useLocation } from 'react-router-dom'
import { Mic, Pencil, Camera, FileText, Flame } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Tooltip } from './Tooltip'

const secondaryFabClass =
  'flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] shadow-md transition-transform hover:scale-105 active:scale-95'

export function FAB() {
  const navigate = useNavigate()
  const location = useLocation()
  const isKeyboardOpen = useUIStore((s) => s.isKeyboardOpen)
  const ephemeralBrainDumpEnabled = useSettingsStore((s) => s.settings.livingWorkspace.ephemeralBrainDumpEnabled)

  // Hide FAB on standard desktop (lg) editor modal, but keep visible on wide desktop (xl) split view
  const isWideDesktop = useUIStore((s) => s.isWideDesktop)
  const isEditorRoute = /^\/memo\/\d+$/.test(location.pathname) || location.pathname === '/memo/new'
  const hideFabOnDesktop = isEditorRoute && !isWideDesktop

  // Hide FAB when keyboard is open to prevent iOS fixed element issues
  if (isKeyboardOpen) return null

  const handleMicClick = () => {
    useUIStore.getState().openVoiceModal()
  }

  const handleCameraClick = () => {
    useUIStore.getState().openImageOCRModal()
  }

  return (
    <div
      className={`fab-button fixed right-4 z-50 flex flex-col items-center gap-3 md:right-8 ${hideFabOnDesktop ? 'lg:hidden' : ''}`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
    >
      {/* Voice memo + Image OCR — always available (server proxy) */}
      <Tooltip content="음성 메모" placement="left">
        <button onClick={handleMicClick} className={secondaryFabClass} aria-label="음성으로 메모 추가">
          <Mic className="h-5 w-5" />
        </button>
      </Tooltip>
      <Tooltip content="이미지 텍스트 추출" placement="left">
        <button onClick={handleCameraClick} className={secondaryFabClass} aria-label="이미지에서 텍스트 추출">
          <Camera className="h-5 w-5" />
        </button>
      </Tooltip>

      {/* Brain dump button */}
      {ephemeralBrainDumpEnabled && (
        <Tooltip content="브레인 덤프" placement="left">
          <button
            onClick={() => navigate('/memo/new?ephemeral=true')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-amber-900/40 dark:text-amber-400"
            aria-label="브레인 덤프"
          >
            <Flame className="h-5 w-5" />
          </button>
        </Tooltip>
      )}

      {/* Template memo button */}
      <Tooltip content="템플릿으로 작성" placement="left">
        <button
          onClick={() => useUIStore.getState().openTemplateModal()}
          className={secondaryFabClass}
          aria-label="템플릿으로 메모 작성"
        >
          <FileText className="h-5 w-5" />
        </button>
      </Tooltip>

      {/* New memo button */}
      <Tooltip content="새 메모" placement="left">
        <button
          onClick={() => navigate('/memo/new')}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="새 메모 작성"
        >
          <Pencil className="h-6 w-6" />
        </button>
      </Tooltip>
    </div>
  )
}
