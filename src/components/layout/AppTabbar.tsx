/* 하단 탭: 900px 이하에서 사이드바를 대신해요. 네 곳 + 더보기.
   더보기 시트에는 탭에 없는 메뉴(만들기, 중요, 폴더, 태그, 관리)가 들어 있어요.
   규격: https://ux.moonwave.kr/patterns/app-shell#tabbar */
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { haptics } from '@/mw/haptics'
import { Sheet } from '@/mw/Sheet'
import {
  IcLineCalendar, IcLineCamera, IcLineDocument, IcLineDocumentAlt, IcLineHome, IcLineMic, IcLineMore, IcLineQuestion, IcLineSearch,
  IcLineSetting, IcLineTrash, IcMwFlame, IcMwNote, IcMwStar, IcMwTag,
} from '@/mw/icons'
import { FIND_PATH, plainClick, tabOf, useNavActions, useNavCurrent } from './nav'

export function AppTabbar({ scroller, inert }: { scroller: RefObject<HTMLElement | null>; inert?: boolean }) {
  const current = useNavCurrent()
  const tab = tabOf(current)
  const go = useNavActions()
  const location = useLocation()
  const [more, setMore] = useState(false)

  // 화면이 바뀌면 시트를 닫아요
  useEffect(() => { setMore(false) }, [location.pathname, location.search])

  const tabs = [
    { id: 'home', label: '홈', to: '/', icon: IcLineHome, run: go.home },
    { id: 'memos', label: '메모', to: '/memos', icon: IcMwNote, run: go.memos },
    { id: 'calendar', label: '캘린더', to: '/calendar', icon: IcLineCalendar, run: go.calendar },
    { id: 'find', label: '찾기', to: FIND_PATH, icon: IcLineSearch, run: go.find },
  ] as const

  return (
    <>
      <nav className="mw-app-tabbar" aria-label="하단 메뉴" inert={inert || undefined}>
        {tabs.map((t) => (
          <Link
            key={t.id}
            className="mw-app-tabbar__item"
            to={t.to}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={(e) => {
              if (!plainClick(e)) return
              e.preventDefault()
              haptics.tap()
              // 지금 있는 탭을 다시 누르면 맨 위로 올려요
              if (tab === t.id && location.pathname === t.to.split('?')[0]) scroller.current?.scrollTo({ top: 0 })
              else t.run()
            }}
          >
            <t.icon size={24} /><span>{t.label}</span>
          </Link>
        ))}
        <button type="button" className="mw-app-tabbar__item" aria-expanded={more} aria-current={tab === 'more' ? 'page' : undefined} onClick={() => { haptics.tap(); setMore(true) }}>
          <IcLineMore size={24} /><span>더보기</span>
        </button>
      </nav>
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </>
  )
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useNavCurrent()
  const go = useNavActions()
  const navigate = useNavigate()
  const folders = useFolderStore((s) => s.folders)
  const brainDump = useSettingsStore((s) => s.settings.livingWorkspace.ephemeralBrainDumpEnabled)
  const { starredCount, deletedCount, folderCounts, allTags, tagCounts } = useMemoStats()
  const [showTags, setShowTags] = useState(false)
  const userFolders = folders.filter((f) => !f.isSystem)
  const trashFolder = folders.find((f) => f.isSystem)
  const ui = useUIStore.getState
  const page = (key: string) => (current === key ? 'page' as const : undefined)
  const pick = (run: () => void) => () => { onClose(); run() }

  return (
    <Sheet open={open} onClose={onClose} label="더보기">
      <div className="mw-sheet__body">
        <div className="memo-sheet__section">만들기</div>
        <button type="button" className="mw-sheet__item" onClick={pick(() => ui().openVoiceModal())}>
          <span className="mw-sheet__icon"><IcLineMic size={24} /></span><span><b>음성 메모</b><small>말한 것을 글로 받아 적어요</small></span>
        </button>
        <button type="button" className="mw-sheet__item" onClick={pick(() => ui().openImageOCRModal())}>
          <span className="mw-sheet__icon"><IcLineCamera size={24} /></span><span><b>사진에서 글자</b><small>사진 속 글자를 메모로 옮겨요</small></span>
        </button>
        <button type="button" className="mw-sheet__item" onClick={pick(() => ui().openTemplateModal())}>
          <span className="mw-sheet__icon"><IcLineDocumentAlt size={24} /></span><span><b>템플릿</b><small>정해 둔 틀로 시작해요</small></span>
        </button>
        {brainDump && (
          <button type="button" className="mw-sheet__item" onClick={pick(() => navigate('/memo/new?ephemeral=true'))}>
            <span className="mw-sheet__icon"><IcMwFlame size={24} /></span><span><b>브레인 덤프</b><small>한 시간 뒤에 사라지는 메모예요</small></span>
          </button>
        )}

        <div className="memo-sheet__section">메모</div>
        <button type="button" className="mw-sheet__item" aria-current={page('starred')} onClick={pick(go.starred)}>
          <span className="mw-sheet__icon"><IcMwStar size={24} /></span><span><b>중요</b></span><span className="memo-sheet__count">{starredCount}</span>
        </button>
        {userFolders.map((folder) => (
          <button key={folder.id} type="button" className="mw-sheet__item" aria-current={page(`folder:${folder.id}`)} onClick={pick(() => go.folder(folder.id!))}>
            <span className="mw-sheet__icon"><i className="memo-sheet__dot" style={{ backgroundColor: folder.color }} /></span>
            <span><b>{folder.name}</b></span><span className="memo-sheet__count">{folderCounts.get(folder.id!) || 0}</span>
          </button>
        ))}
        {trashFolder && (
          <button type="button" className="mw-sheet__item" aria-current={page(`folder:${trashFolder.id}`)} onClick={pick(() => go.folder(trashFolder.id!))}>
            <span className="mw-sheet__icon"><IcLineTrash size={24} /></span><span><b>휴지통</b></span><span className="memo-sheet__count">{deletedCount}</span>
          </button>
        )}
        {allTags.length > 0 && (
          <button type="button" className="mw-sheet__item" aria-expanded={showTags} aria-current={!showTags && current.startsWith('tag:') ? 'page' : undefined} onClick={() => setShowTags((v) => !v)}>
            <span className="mw-sheet__icon"><IcMwTag size={24} /></span>
            <span><b>태그</b><small>{showTags ? '눌러서 접어요' : '눌러서 펼쳐요'}</small></span><span className="memo-sheet__count">{allTags.length}</span>
          </button>
        )}
        {showTags && allTags.map((tag) => (
          <button key={tag} type="button" className="mw-sheet__item" aria-current={page(`tag:${tag}`)} onClick={pick(() => go.tag(tag))}>
            <span className="mw-sheet__icon"><IcMwTag size={24} /></span><span><b>{tag}</b></span><span className="memo-sheet__count">{tagCounts.get(tag) || 0}</span>
          </button>
        ))}

        <div className="memo-sheet__section">관리</div>
        <button type="button" className="mw-sheet__item" onClick={pick(() => ui().openFAQModal())}>
          <span className="mw-sheet__icon"><IcLineQuestion size={24} /></span><span><b>도움말</b></span>
        </button>
        <button type="button" className="mw-sheet__item" onClick={pick(() => ui().openSettingsModal())}>
          <span className="mw-sheet__icon"><IcLineSetting size={24} /></span><span><b>설정</b></span>
        </button>
        <button type="button" className="mw-sheet__item" onClick={pick(() => ui().openTermsModal())}>
          <span className="mw-sheet__icon"><IcLineDocument size={24} /></span><span><b>약관</b></span>
        </button>
      </div>
    </Sheet>
  )
}
