import { ArrowLeft, ChevronRight, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { useFolderStore } from '@/stores/folderStore'
import { MEMO_COLORS } from '@/utils/constants'
import type { ThemeMode, MemoColor, InputStartPosition } from '@/lib/types'

export function SettingsPage() {
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setDefaultColor = useSettingsStore((s) => s.setDefaultColor)
  const setDefaultFolder = useSettingsStore((s) => s.setDefaultFolder)
  const setInputStartPosition = useSettingsStore((s) => s.setInputStartPosition)
  const toggleHashtagToTag = useSettingsStore((s) => s.toggleHashtagToTag)
  const toggleLinkPreview = useSettingsStore((s) => s.toggleLinkPreview)
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const folders = useFolderStore((s) => s.folders).filter((f) => !f.isSystem)

  const themeLabel: Record<ThemeMode, string> = {
    light: '라이트 모드',
    dark: '다크 모드',
    system: '시스템',
  }

  const cycleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(settings.theme)
    setTheme(modes[(currentIndex + 1) % modes.length])
  }

  const defaultFolder = folders.find((f) => f.id === settings.memoSettings.defaultFolderId) || folders.find((f) => f.isDefault)
  const positionLabel: Record<InputStartPosition, string> = { title: '제목', body: '본문' }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 lg:px-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">설정</h1>
      </div>

      {/* Account */}
      <div className="px-4 lg:px-0 mb-6">
        {user ? (
          <div className="flex items-center gap-3 py-3">
            <img
              src={user.photoURL || undefined}
              alt=""
              className="w-10 h-10 rounded-full bg-zinc-200"
            />
            <div className="flex-1">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</p>
              <p className="text-sm text-zinc-500">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="w-full py-3 text-sm font-medium text-white bg-primary-500 rounded-xl hover:bg-primary-600"
          >
            Google 로그인
          </button>
        )}
      </div>

      {/* Theme */}
      <SettingRow
        label="다크 모드"
        icon={<Moon className="w-4 h-4" />}
        value={themeLabel[settings.theme]}
        onClick={cycleTheme}
      />

      {/* Font */}
      <SettingRow
        label="글자 크기·글꼴"
        onClick={() => navigate('/settings/font')}
      />

      {/* Memo Section */}
      <div className="px-4 lg:px-0 pt-6 pb-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">메모</h2>
      </div>

      {/* Default Color */}
      <div className="flex items-center justify-between px-4 lg:px-0 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">기본 메모 색상</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(Object.keys(MEMO_COLORS) as MemoColor[]).map((c) => (
              <button
                key={c}
                onClick={() => setDefaultColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  settings.memoSettings.defaultColor === c
                    ? 'border-primary-500 scale-110'
                    : 'border-zinc-200 dark:border-zinc-600'
                }`}
                style={{ backgroundColor: MEMO_COLORS[c] }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Default Folder */}
      <SettingRow
        label="기본 폴더"
        value={defaultFolder?.name || '내 메모'}
        onClick={() => {
          const currentIdx = folders.findIndex((f) => f.id === settings.memoSettings.defaultFolderId)
          const nextFolder = folders[(currentIdx + 1) % folders.length]
          setDefaultFolder(nextFolder?.id ?? null)
        }}
      />

      {/* Input Start Position */}
      <SettingRow
        label="입력 시작 위치"
        value={positionLabel[settings.memoSettings.inputStartPosition]}
        onClick={() => {
          setInputStartPosition(
            settings.memoSettings.inputStartPosition === 'title' ? 'body' : 'title'
          )
        }}
      />

      {/* Toggle Settings */}
      <ToggleRow
        label="'#텍스트' 입력 시 태그로 변환"
        description="태그로 변환 후에는 해당 태그를 포함하는 메모를 모아볼 수 있습니다."
        checked={settings.memoSettings.hashtagToTag}
        onChange={toggleHashtagToTag}
      />

      <ToggleRow
        label="링크 미리보기 표시"
        description="URL 입력 시 링크 미리보기를 함께 표시합니다."
        checked={settings.memoSettings.linkPreview}
        onChange={toggleLinkPreview}
      />

      <div className="h-20" />
    </div>
  )
}

function SettingRow({
  label,
  icon,
  value,
  onClick,
}: {
  label: string
  icon?: React.ReactNode
  value?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 lg:px-0 py-3.5 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
        {value && <span>{value}</span>}
        <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-start justify-between px-4 lg:px-0 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
      <div className="flex-1 pr-4">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
        {description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white dark:bg-zinc-900 transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
