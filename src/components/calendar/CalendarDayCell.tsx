import { memo } from 'react'
import { format, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import clsx from 'clsx'
import type { Memo } from '@/lib/types'

// 자동 제목 '[폴더]_요약_YYMMDD'는 셀 칩에서 요약만 남긴다 (표시 전용, 데이터 불변)
function stripAutoTitle(title: string): string {
  return title.replace(/^\[[^\]]+\]_/, '').replace(/_\d{6}$/, '')
}

// 밀도 3버킷 — 정보는 폭으로만 인코딩 (opacity 램프·배경 틴트는 시인성/채널 충돌로 금지)
function densityWidthClass(count: number): string {
  if (count >= 5) return 'w-4'
  if (count >= 2) return 'w-2.5'
  return 'w-1'
}

const FALLBACK_FOLDER_DOT = '#a1a1aa'

interface CalendarDayCellProps {
  day: Date
  dateStr: string
  inMonth: boolean
  isSelected: boolean
  isTodayDate: boolean
  count: number
  chipMemos: Memo[]
  folderColorById: Map<number, string>
  tabbable: boolean
  onSelect: (day: Date, dateStr: string) => void
}

/**
 * 이중 모드 날짜 셀 — 캘린더 카드의 @container 폭이 결정한다 (뷰포트 분기 코드 없음).
 * 컴팩트(<@lg 512px): h-11 행 + 중앙 디스크 + 하단 밀도 바.
 * 확장(≥@lg): hairline 그리드 타일 — 좌상단 날짜 + 메모 제목 칩 최대 2개 + "+N".
 */
export const CalendarDayCell = memo(function CalendarDayCell({
  day,
  dateStr,
  inMonth,
  isSelected,
  isTodayDate,
  count,
  chipMemos,
  folderColorById,
  tabbable,
  onSelect,
}: CalendarDayCellProps) {
  const dayOfWeek = getDay(day)

  return (
    <button
      type="button"
      data-date={dateStr}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSelect(day, dateStr)}
      aria-label={`${format(day, 'M월 d일 EEEE', { locale: ko })}${count > 0 ? `, 메모 ${count}개` : ''}`}
      aria-pressed={isSelected}
      aria-current={isTodayDate ? 'date' : undefined}
      title={count > 0 ? `메모 ${count}개` : undefined}
      className={clsx(
        // 컴팩트: 44px 터치 타깃 행 셀 (42셀 고정 → 카드 높이가 월과 무관하게 불변)
        'relative flex h-11 items-center justify-center rounded-lg transition-colors duration-150 ease-standard',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset',
        // 확장: min-h 램프 — 태블릿은 5rem 캡, 6/7rem은 데스크톱(lg) 한정이라 스택 레이아웃에서 리스트를 밀지 않음
        '@lg:h-auto @lg:min-h-[4.5rem] max-lg:@2xl:min-h-[5rem] lg:@2xl:min-h-[6rem] lg:@3xl:min-h-[7rem]',
        '@lg:flex-col @lg:items-start @lg:justify-start @lg:gap-1 @lg:rounded-none @lg:p-1.5 @lg:text-left @2xl:p-2',
        // 확장 모드 타일은 불투명 배경 필수 (그리드 래퍼의 hairline 색이 gap으로 비침)
        isSelected
          ? '@lg:bg-[var(--color-bg-secondary)] dark:@lg:bg-white/[0.04]'
          : '@lg:bg-[var(--card-bg-default)]',
        !isSelected && [
          '@max-lg:hover:bg-[var(--color-surface-hover)] @max-lg:active:bg-[var(--color-surface-active)]',
          '@lg:hover:bg-[var(--color-surface-hover)]',
        ]
      )}
    >
      {/* 날짜 숫자 디스크 — 선택=accent 채움(행동), 오늘=틴트(위치) */}
      <span
        className={clsx(
          'flex items-center justify-center rounded-full tabular-nums transition-colors duration-150',
          'h-8 w-8 text-xs fold:h-7 fold:w-7',
          '@lg:h-6 @lg:w-6 @lg:text-[13px] @2xl:h-7 @2xl:w-7 @2xl:text-sm',
          isSelected || isTodayDate ? 'font-semibold' : inMonth ? 'font-medium' : 'font-normal',
          isSelected &&
            'bg-[var(--color-accent)] text-[var(--color-on-accent)] motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-150 motion-safe:ease-spring',
          !isSelected && isTodayDate && 'bg-primary-500/10 text-primary-600 dark:text-primary-400',
          !isSelected && !isTodayDate && !inMonth && 'text-zinc-500 dark:text-zinc-400',
          !isSelected && !isTodayDate && inMonth && dayOfWeek === 0 && 'text-danger-600 dark:text-danger-400',
          !isSelected && !isTodayDate && inMonth && dayOfWeek === 6 && 'text-primary-600 dark:text-primary-400',
          !isSelected && !isTodayDate && inMonth && dayOfWeek > 0 && dayOfWeek < 6 &&
            'text-zinc-700 dark:text-zinc-300'
        )}
      >
        {format(day, 'd')}
      </span>

      {/* 밀도 바 (컴팩트 전용) — 1개=w-1 / 2–4개=w-2.5 / 5개+=w-4, accent 단색 */}
      {inMonth && count > 0 && (
        <span
          aria-hidden
          className={clsx(
            'absolute bottom-1 left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-[var(--color-accent)]',
            'transition-[width] duration-200 ease-standard motion-reduce:transition-none @lg:hidden',
            densityWidthClass(count)
          )}
        />
      )}

      {/* 메모 제목 칩 (확장 전용, 최대 2개 + 정확한 +N) — 표시 전용, 셀이 유일한 클릭 타깃 */}
      {inMonth && chipMemos.length > 0 && (
        <span aria-hidden className="hidden w-full min-w-0 flex-col gap-[3px] @lg:flex">
          {chipMemos.map((m) => (
            <span
              key={m.id}
              className="pointer-events-none flex h-[18px] w-full items-center gap-1 overflow-hidden rounded-[4px] bg-[var(--color-bg-tertiary)] px-1 dark:bg-white/[0.07]"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    m.folderId != null
                      ? folderColorById.get(m.folderId) ?? FALLBACK_FOLDER_DOT
                      : FALLBACK_FOLDER_DOT,
                }}
              />
              <span className="min-w-0 truncate text-[11px] font-medium leading-none text-zinc-600 dark:text-zinc-300">
                {stripAutoTitle(m.title) || '제목 없음'}
              </span>
            </span>
          ))}
          {count > chipMemos.length && (
            <span className="px-1 text-[10px] leading-none tabular-nums text-[var(--color-text-tertiary)]">
              +{count - chipMemos.length}
            </span>
          )}
        </span>
      )}
    </button>
  )
})
