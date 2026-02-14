import { Menu, Search, MoreVertical } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

export function Header() {
  const { openMobileMenu, setSearchQuery, searchQuery } = useUIStore()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95">
      {/* Left: hamburger for mobile */}
      <button
        onClick={openMobileMenu}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Center spacer on mobile, hidden on desktop where sidebar handles branding */}
      <div className="flex-1 md:hidden" />

      {/* Right: search + more */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            // Toggle search — focus the search input or open search view
            const nextQuery = searchQuery ? '' : searchQuery
            setSearchQuery(nextQuery)
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="검색"
        >
          <Search className="h-5 w-5" />
        </button>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="더보기"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
