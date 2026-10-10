import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import type { SortBy } from '@/lib/types'
import { IcLineClose, IcMwSort } from '@/mw/icons'

const SORT_LABELS: Record<SortBy, string> = {
  updatedAt: '수정일',
  createdAt: '생성일',
  title: '이름순',
}
const SORT_ORDER: SortBy[] = ['updatedAt', 'createdAt', 'title']

export function MemoFilterTabs() {
  const folders = useFolderStore((s) => s.folders)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const activeTag = useUIStore((s) => s.activeTag)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)
  const sortBy = useUIStore((s) => s.sortBy)
  const setSortBy = useUIStore((s) => s.setSortBy)

  const userFolders = folders
    .filter((f) => !f.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const isAllActive = activeFilter === 'all' && activeFolderId == null && activeTag == null
  const isStarredActive = activeFilter === 'starred'

  // 좁은 화면에서만 보여요(넓은 화면에서는 사이드바가 같은 일을 해요). 키트의 Scrollable 탭이에요.
  const tab = (selected: boolean) => `mw-tab mw-tab--scrollable mw-tab--${selected ? 'selected' : 'default'}`
  return (
    <div className="flex items-center gap-2 lg:hidden">
      <div className="mw-tab-group mw-tab-group--scrollable min-w-0 flex-1" role="tablist" aria-label="메모 거르기">
        <button type="button" onClick={() => setActiveFilter('all')} role="tab" aria-selected={isAllActive} className={tab(isAllActive)}>
          전체
        </button>
        <button type="button" onClick={() => setActiveFilter('starred')} role="tab" aria-selected={isStarredActive} className={tab(isStarredActive)}>
          중요
        </button>
        {userFolders.map((folder) => {
          const isActive = activeFolderId === folder.id
          return (
            <button key={folder.id} type="button" onClick={() => setActiveFolderId(folder.id!)} role="tab" aria-selected={isActive} className={tab(isActive)}>
              {folder.name}
            </button>
          )
        })}
      </div>

      {/* 고른 태그: 누르면 풀려요 */}
      {activeTag && (
        <button type="button" onClick={() => setActiveFilter('all')} className="mw-input-chip mw-input-chip--on" aria-label={`태그 ${activeTag} 풀기`}>
          #{activeTag}
          <span className="mw-input-chip__icon"><IcLineClose size={16} /></span>
        </button>
      )}

      {/* Sort indicator chip */}
      <button type="button"
        onClick={() => {
          const idx = SORT_ORDER.indexOf(sortBy)
          setSortBy(SORT_ORDER[(idx + 1) % SORT_ORDER.length])
        }}
        className="mw-button mw-button--tertiary-subtle mw-button--medium mw-button--icon-left shrink-0"
        aria-label={`정렬: ${SORT_LABELS[sortBy]}`}
      >
        <IcMwSort size={12} />
        {SORT_LABELS[sortBy]}
      </button>
    </div>
  )
}
