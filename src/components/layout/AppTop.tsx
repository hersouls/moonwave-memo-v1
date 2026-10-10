/* 상단 바: 넓은 화면에서는 찾기 바, 좁은 화면에서는 서비스 이름. 오른쪽에는 아이콘 버튼을 둘까지 둬요.
   규격: https://ux.moonwave.kr/patterns/app-shell#topbar */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { ConnectionStatus } from '@/components/ui/ConnectionStatus'
import { WeatherWidget } from '@/components/ui/WeatherWidget'
import { IcLineCloud, IcLineDesktop, IcLineSearch, IcLineSetting, IcMwMoon, IcMwSun } from '@/mw/icons'
import { TextButton } from '@/mw/TextButton'
import { useCloseRequest } from '@/mw/close'
import type { ThemeMode } from '@/lib/types'

const THEME_LABEL: Record<ThemeMode, string> = { system: '시스템 설정 따르기', light: '밝게', dark: '어둡게' }
const NEXT_THEME: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

/** 시스템 → 밝게 → 어둡게를 돌려요 (https://ux.moonwave.kr/patterns/theme#rule) */
function ThemeButton() {
  const theme = useSettingsStore((s) => s.settings.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const Icon = theme === 'system' ? IcLineDesktop : theme === 'light' ? IcMwSun : IcMwMoon
  return (
    <button type="button" className="mw-icon-button" onClick={() => setTheme(NEXT_THEME[theme])} title={`테마: ${THEME_LABEL[theme]}`} aria-label={`테마 바꾸기. 지금은 ${THEME_LABEL[theme]}`}>
      <Icon size={20} />
    </button>
  )
}

const SYNC_LABEL = { syncing: '동기화하고 있어요', synced: '동기화했어요', error: '동기화하지 못했어요', offline: '연결되면 동기화해요', idle: '이 기기에만 저장해요' } as const

function ProfileMenu() {
  const user = useAuthStore((s) => s.user)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const logout = useAuthStore((s) => s.logout)
  const openSettingsModal = useUIStore((s) => s.openSettingsModal)
  const [open, setOpen] = useState(false)
  useCloseRequest(open, () => setOpen(false))

  if (!user) {
    return (
      <button type="button" className="mw-icon-button" onClick={openSettingsModal} aria-label="설정 열기" title="설정">
        <IcLineSetting size={20} />
      </button>
    )
  }
  return (
    <div className="memo-top__profile" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}>
      <button type="button" className="mw-icon-button" onClick={() => setOpen((v) => !v)} aria-label="내 계정" aria-haspopup="menu" aria-expanded={open}>
        {user.photoURL
          ? <img className="memo-top__avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          : <span className="memo-top__initial" aria-hidden="true">{user.displayName?.[0] || user.email?.[0] || '?'}</span>}
      </button>
      {open && (
        <div className="memo-top__menu" role="menu">
          <div className="memo-top__who">
            <b>{user.displayName || '이름 없음'}</b>
            <small>{user.email}</small>
          </div>
          <div className="memo-top__state"><IcLineCloud size={16} />{SYNC_LABEL[syncStatus] ?? SYNC_LABEL.idle}</div>
          <div className="memo-top__menu-actions">
            <TextButton role="menuitem" onClick={() => { setOpen(false); openSettingsModal() }}>설정</TextButton>
            <TextButton role="menuitem" onClick={() => { setOpen(false); logout() }}>로그아웃</TextButton>
          </div>
        </div>
      )}
    </div>
  )
}

export function AppTop({ narrow, inert }: { narrow: boolean; inert?: boolean }) {
  const navigate = useNavigate()
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const input = useRef<HTMLInputElement>(null)

  return (
    <header className="mw-app-top" inert={inert || undefined}>
      {narrow ? (
        <span className="mw-app-top__title">Moonwave <span>Memo</span></span>
      ) : (
        <label className="mw-searchbar">
          <IcLineSearch size={20} />
          <input
            ref={input}
            placeholder="제목, 내용, 태그로 찾기"
            aria-label="찾기"
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
              const ui = useUIStore.getState()
              ui.setActiveFilter('all')
              setSearchQuery(e.currentTarget.value.trim())
              e.currentTarget.value = ''
              navigate('/memos')
            }}
          />
        </label>
      )}
      <span className="mw-app-top__spacer" />
      {!narrow && <WeatherWidget />}
      <ConnectionStatus />
      <ThemeButton />
      <ProfileMenu />
    </header>
  )
}
