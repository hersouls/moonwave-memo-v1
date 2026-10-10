import clsx from 'clsx'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import type { SortBy } from '@/lib/types'
import { IcMwSort } from '@/mw/icons'

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

  // A11Y-01: role="tablist" + UX-01: hide when sidebar open on desktop
  return (
    <div
      className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-2 lg:hidden"
      role="tablist"
      aria-label="메모 필터"
    >
      {/* A11Y-01: role="tab" + aria-selected */}
      <button
        onClick={() => setActiveFilter('all')}
        role="tab"
        aria-selected={isAllActive}
        className={clsx(
          'shrink-0 chip-text chip-text--sm',
          isAllActive ? 'chip-text--pressed' : 'chip-text--bordered'
        )}
      >
        전체
      </button>

      <button
        onClick={() => setActiveFilter('starred')}
        role="tab"
        aria-selected={isStarredActive}
        className={clsx(
          'shrink-0 chip-text chip-text--sm',
          isStarredActive ? 'chip-text--pressed' : 'chip-text--bordered'
        )}
      >
        중요
      </button>

      {/* Folder tabs */}
      {userFolders.map((folder) => {
        const isActive = activeFolderId === folder.id
        return (
          <button
            key={folder.id}
            onClick={() => setActiveFolderId(folder.id!)}
            role="tab"
            aria-selected={isActive}
            className={clsx(
              'shrink-0 chip-text chip-text--sm',
              isActive ? 'chip-text--pressed' : 'chip-text--bordered'
            )}
          >
            {folder.name}
          </button>
        )
      })}

      {/* Active tag indicator — accent tokens keep white text AA in dark palettes */}
      {activeTag && (
        <button
          onClick={() => setActiveFilter('all')}
          className="shrink-0 chip-text chip-text--sm bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]"
        >
          #{activeTag}
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
