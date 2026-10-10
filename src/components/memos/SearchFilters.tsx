import { useUIStore } from '@/stores/uiStore'

const DATE_OPTIONS: { value: 'all' | 'today' | 'week' | 'month'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
]

/** 찾은 결과를 기간과 중요 표시로 걸러요. 키트의 Select 칩 한 줄이에요. */
export function SearchFilters() {
  const searchFilters = useUIStore((s) => s.searchFilters)
  const setSearchFilters = useUIStore((s) => s.setSearchFilters)

  return (
    <div className="mw-chip-group-wrapper">
      <div className="mw-chip-group" role="group" aria-label="기간과 중요 표시로 거르기">
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={searchFilters.dateRange === opt.value}
            onClick={() => setSearchFilters({ dateRange: opt.value })}
            className={`mw-select-chip mw-select-chip--${searchFilters.dateRange === opt.value ? 'on' : 'off'}`}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={searchFilters.starredOnly}
          onClick={() => setSearchFilters({ starredOnly: !searchFilters.starredOnly })}
          className={`mw-select-chip mw-select-chip--${searchFilters.starredOnly ? 'on' : 'off'}`}
        >
          중요만
        </button>
      </div>
    </div>
  )
}
