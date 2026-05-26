import { useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp, Type, FileText } from 'lucide-react'
import clsx from 'clsx'
import { useWritingAnalytics } from '@/hooks/useWritingAnalytics'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function AnalyticsWidget() {
  const [isExpanded, setIsExpanded] = useState(false)
  const analytics = useWritingAnalytics()

  const maxHour = Math.max(...analytics.hourDistribution, 1)
  const maxDay = Math.max(...analytics.dayDistribution, 1)
  const maxMonthly = Math.max(...analytics.monthlyTrend.map((m) => m.count), 1)

  return (
    <div className="card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-900/20">
          <BarChart3 className="h-4 w-4 text-cyan-500" />
        </div>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex-1 text-left">
          {'작성 분석'}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Summary stats — always visible */}
      <div className="flex gap-6 px-5 pb-3">
        <div className="flex items-center gap-2">
          <Type className="w-3.5 h-3.5 text-zinc-400" />
          <div>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {analytics.totalWords.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{'총 단어'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-zinc-400" />
          <div>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {analytics.averageLength.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{'평균 글자'}</p>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-700 px-5 py-4 space-y-5">
          {/* Hour distribution */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              {'시간대별 작성 분포'}
            </h4>
            <div className="flex items-end gap-[2px] h-16">
              {analytics.hourDistribution.map((count, hour) => (
                <div
                  key={hour}
                  className="flex-1 group relative"
                  title={`${hour}시: ${count}개`}
                >
                  <div
                    className="w-full rounded-sm bg-cyan-400 dark:bg-cyan-500 transition-all group-hover:bg-cyan-500 dark:group-hover:bg-cyan-400"
                    style={{
                      height: `${Math.max((count / maxHour) * 100, count > 0 ? 8 : 2)}%`,
                      minHeight: count > 0 ? '3px' : '1px',
                      opacity: count > 0 ? 1 : 0.2,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-zinc-400">0</span>
              <span className="text-[9px] text-zinc-400">6</span>
              <span className="text-[9px] text-zinc-400">12</span>
              <span className="text-[9px] text-zinc-400">18</span>
              <span className="text-[9px] text-zinc-400">23</span>
            </div>
          </div>

          {/* Day distribution */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              {'요일별 작성 분포'}
            </h4>
            <div className="flex items-end gap-1 h-12">
              {analytics.dayDistribution.map((count, day) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={clsx(
                      'w-full rounded-sm transition-all',
                      day === 0 || day === 6
                        ? 'bg-rose-400 dark:bg-rose-500'
                        : 'bg-cyan-400 dark:bg-cyan-500'
                    )}
                    style={{
                      height: `${Math.max((count / maxDay) * 100, count > 0 ? 12 : 4)}%`,
                      minHeight: count > 0 ? '3px' : '1px',
                      opacity: count > 0 ? 1 : 0.2,
                    }}
                  />
                  <span className={clsx(
                    'text-[9px]',
                    day === 0 || day === 6
                      ? 'text-rose-400 dark:text-rose-500'
                      : 'text-zinc-400 dark:text-zinc-500'
                  )}>
                    {DAY_LABELS[day]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly trend */}
          {analytics.monthlyTrend.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                {'월별 추세'}
              </h4>
              <div className="flex items-end gap-2 h-12">
                {analytics.monthlyTrend.map((item) => (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-violet-400 dark:bg-violet-500"
                      style={{
                        height: `${Math.max((item.count / maxMonthly) * 100, 8)}%`,
                        minHeight: '3px',
                      }}
                    />
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                      {item.month.split('-')[1]}{'월'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top tags */}
          {analytics.topTags.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                {'상위 태그'}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {analytics.topTags.map(({ tag, count }) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
                  >
                    #{tag}
                    <span className="text-[10px] text-cyan-400 dark:text-cyan-500">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
