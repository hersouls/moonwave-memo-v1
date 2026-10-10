/* 사이드바: 넓은 화면(901px부터)의 주 메뉴예요. 뼈대와 치수는 키트의 mw-app-nav 그대로예요.
   규격: https://ux.moonwave.kr/patterns/app-shell#sidebar */
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { useAuthStore } from '@/stores/authStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useToastStore } from '@/stores/toastStore'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FolderEditModal } from '@/components/folders/FolderEditModal'
import {
  IcLineCalendar, IcLineChevronDown, IcLineDocument, IcLineEdit, IcLineHome, IcLineMore, IcLineQuestion, IcLineSetting, IcLineTrash,
  IcMwNote, IcMwStar, IcMwTag,
} from '@/mw/icons'
import type { Folder } from '@/lib/types'
import { plainClick, useNavActions, useNavCurrent } from './nav'

const SYNC_LABEL = {
  syncing: '동기화하고 있어요',
  synced: '동기화했어요',
  error: '동기화하지 못했어요',
  offline: '연결되면 동기화해요',
  idle: '이 기기에만 저장해요',
} as const

function Count({ n }: { n: number }) {
  return <span className="memo-nav__count">{n > 999 ? '999+' : n}</span>
}

export function AppNav({ inert }: { inert?: boolean }) {
  const current = useNavCurrent()
  const go = useNavActions()
  const isTagsOpen = useUIStore((s) => s.isTagsSectionOpen)
  const toggleTags = useUIStore((s) => s.toggleTagsSection)
  const openSettingsModal = useUIStore((s) => s.openSettingsModal)
  const openFAQModal = useUIStore((s) => s.openFAQModal)
  const openTermsModal = useUIStore((s) => s.openTermsModal)
  const folders = useFolderStore((s) => s.folders)
  const deleteFolder = useFolderStore((s) => s.deleteFolder)
  const moveToFolder = useMemoStore((s) => s.moveToFolder)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const isOnline = useOnlineStatus()
  const { totalCount, starredCount, deletedCount, folderCounts, allTags, tagCounts } = useMemoStats()

  const userFolders = folders.filter((f) => !f.isSystem)
  const trashFolder = folders.find((f) => f.isSystem)
  const activeTag = current.startsWith('tag:') ? current.slice(4) : null

  // 메모를 끌어 폴더에 놓기
  const [dropFolderId, setDropFolderId] = useState<number | null>(null)
  const onDragOver = useCallback((e: React.DragEvent, folderId: number) => {
    if (!e.dataTransfer.types.includes('application/memo-id')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropFolderId(folderId)
  }, [])
  const onDrop = useCallback(async (e: React.DragEvent, folderId: number) => {
    e.preventDefault()
    setDropFolderId(null)
    const memoId = Number(e.dataTransfer.getData('application/memo-id'))
    if (!Number.isFinite(memoId) || !memoId) return
    try {
      await moveToFolder(memoId, folderId)
      const folder = useFolderStore.getState().folders.find((f) => f.id === folderId)
      useToastStore.getState().showToast(`'${folder?.name ?? '폴더'}'(으)로 옮겼어요`, 'success')
    } catch {
      useToastStore.getState().showToast('메모를 옮기지 못했어요. 다시 시도해 주세요', 'error')
    }
  }, [moveToFolder])

  // 폴더 관리: 메뉴(오른쪽 버튼 · 관리 버튼) → 고치기 · 지우기
  const [folderMenu, setFolderMenu] = useState<{ folder: Folder; x: number; y: number } | null>(null)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)

  const page = (key: string) => (current === key ? 'page' as const : undefined)
  const offline = !isOnline || syncStatus === 'offline'

  return (
    <nav className="mw-app-nav" aria-label="주 메뉴" inert={inert || undefined}>
      <Link className="mw-app-nav__brand" to="/" onClick={(e) => { if (plainClick(e)) { e.preventDefault(); go.home() } }}>
        <img className="mw-mark" src="/icons/icon-192.png" alt="" width={32} height={32} />
        <span><b>Moonwave <span>Memo</span></b><small>말하고 적은 것을 한곳에</small></span>
      </Link>

      <div className="mw-app-nav__section">둘러보기</div>
      <Link className="mw-app-nav__item" to="/" aria-current={page('home')} onClick={(e) => { if (plainClick(e)) { e.preventDefault(); go.home() } }}>
        <IcLineHome size={20} />홈
      </Link>
      <Link className="mw-app-nav__item" to="/memos" aria-current={page('memos') ?? page('find')} onClick={(e) => { if (plainClick(e)) { e.preventDefault(); go.memos() } }}>
        <IcMwNote size={20} /><span className="memo-nav__label">메모</span><Count n={totalCount} />
      </Link>
      <button type="button" className="mw-app-nav__item" aria-current={page('starred')} onClick={go.starred}>
        <IcMwStar size={20} /><span className="memo-nav__label">중요</span><Count n={starredCount} />
      </button>
      <Link className="mw-app-nav__item" to="/calendar" aria-current={page('calendar')} onClick={(e) => { if (plainClick(e)) { e.preventDefault(); go.calendar() } }}>
        <IcLineCalendar size={20} />캘린더
      </Link>

      <div className="mw-app-nav__section">폴더</div>
      {userFolders.map((folder) => {
        const id = folder.id!
        return (
          <div
            key={id}
            className={`memo-nav__row${dropFolderId === id ? ' memo-nav__row--drop' : ''}`}
            onContextMenu={(e) => { e.preventDefault(); setFolderMenu({ folder, x: e.clientX, y: e.clientY }) }}
            onDragOver={(e) => onDragOver(e, id)}
            onDragLeave={() => setDropFolderId(null)}
            onDrop={(e) => onDrop(e, id)}
          >
            <button type="button" className="mw-app-nav__item" aria-current={page(`folder:${id}`)} onClick={() => go.folder(id)}>
              <span className="memo-nav__dot" style={{ backgroundColor: folder.color }} aria-hidden="true" />
              <span className="memo-nav__label">{folder.name}</span>
              <Count n={folderCounts.get(id) || 0} />
            </button>
            <button
              type="button"
              className="mw-icon-button"
              aria-label={`${folder.name} 폴더 관리`}
              aria-haspopup="menu"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFolderMenu({ folder, x: r.left, y: r.bottom + 4 }) }}
            >
              <IcLineMore size={20} />
            </button>
          </div>
        )
      })}
      {trashFolder && (
        <button type="button" className="mw-app-nav__item" aria-current={page(`folder:${trashFolder.id}`)} onClick={() => go.folder(trashFolder.id!)}>
          <IcLineTrash size={20} /><span className="memo-nav__label">휴지통</span><Count n={deletedCount} />
        </button>
      )}

      {allTags.length > 0 && (
        <>
          <div className="mw-app-nav__section">태그</div>
          {/* 태그는 많아질 수 있어서 접어 둬요. 접혀 있을 때 고른 태그가 있으면 이 줄이 지금 있는 곳이에요. */}
          <button
            type="button"
            className="mw-app-nav__item"
            aria-expanded={isTagsOpen}
            aria-controls="nav-tags"
            aria-current={!isTagsOpen && activeTag ? 'page' : undefined}
            onClick={toggleTags}
          >
            <IcMwTag size={20} />
            <span className="memo-nav__label">{!isTagsOpen && activeTag ? activeTag : '모든 태그'}</span>
            <Count n={allTags.length} />
            <IcLineChevronDown size={16} className="memo-nav__chevron" data-open={isTagsOpen} />
          </button>
          {isTagsOpen && (
            <div id="nav-tags" style={{ display: 'contents' }}>
              {allTags.map((tag) => (
                <button key={tag} type="button" className="mw-app-nav__item" aria-current={page(`tag:${tag}`)} onClick={() => go.tag(tag)}>
                  <IcMwTag size={20} /><span className="memo-nav__label">{tag}</span><Count n={tagCounts.get(tag) || 0} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mw-app-nav__section">관리</div>
      <button type="button" className="mw-app-nav__item" onClick={openFAQModal}><IcLineQuestion size={20} />도움말</button>
      <button type="button" className="mw-app-nav__item" onClick={openSettingsModal}><IcLineSetting size={20} />설정</button>
      <button type="button" className="mw-app-nav__item" onClick={openTermsModal}><IcLineDocument size={20} />약관</button>

      <div className="mw-app-nav__foot">
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
          <i className={`mw-live${offline ? ' mw-live--off' : syncStatus === 'error' ? ' mw-live--down' : ''}`} />
          {offline ? SYNC_LABEL.offline : SYNC_LABEL[syncStatus] ?? SYNC_LABEL.idle}
        </span>
        <small>문의: <a className="memo-nav__foot-link" href="mailto:her_soul@naver.com">her_soul@naver.com</a></small>
      </div>

      {folderMenu && (
        <ContextMenu
          position={{ x: folderMenu.x, y: folderMenu.y }}
          items={[
            { label: '폴더 고치기', icon: IcLineEdit, onSelect: () => setEditingFolder(folderMenu.folder) },
            'divider',
            { label: '지우기', icon: IcLineTrash, danger: true, onSelect: () => setDeletingFolder(folderMenu.folder) },
          ]}
          onClose={() => setFolderMenu(null)}
        />
      )}
      <FolderEditModal isOpen={editingFolder != null} onClose={() => setEditingFolder(null)} folder={editingFolder} />
      <ConfirmDialog
        open={deletingFolder != null}
        onClose={() => setDeletingFolder(null)}
        onConfirm={async () => { if (deletingFolder?.id) await deleteFolder(deletingFolder.id); setDeletingFolder(null) }}
        title="폴더를 지울까요?"
        description={`'${deletingFolder?.name ?? ''}' 폴더를 지워요.\n안에 있던 메모는 기본 폴더로 옮겨져요.`}
        variant="danger"
        confirmText="지우기"
      />
    </nav>
  )
}
