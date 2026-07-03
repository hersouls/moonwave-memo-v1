import { BarChart3, Type, FileText } from 'lucide-react'
import clsx from 'clsx'
import { useWritingAnalytics } from '@/hooks/useWritingAnalytics'
import { WidgetCard } from './WidgetCard'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function AnalyticsWidget() {
  const analytics = useWritingAnalytics()

  const maxHour = Math.max(...analytics.hourDistribution, 1)
  const maxDay = Math.max(...analytics.dayDistribution, 1)
  const maxMonthly = Math.max(...analytics.monthlyTrend.map((m) => m.count), 1)

  return (
    <WidgetCard
      icon={BarChart3}
      title="작성 분석"
      collapsible
      defaultCollapsed
      subheader={
        <div className="flex gap-6 px-5 pb-3">
          <div className="flex items-center gap-2">
            <Type className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">
                {analytics.totalWords.toLocaleString()}
              </p>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{'총 단어'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">
                {analytics.averageLength.toLocaleString()}
              </p>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{'평균 글자'}</p>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Hour distribution */}
        <div>
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            {'시간대별 작성 분포'}
          </h4>
          <div className="flex items-end gap-[2px] h-16">
            {analytics.hourDistribution.map((count, hour) => (
              <div
                key={hour}
                className="flex-1 group relative flex flex-col justify-end self-stretch"
                title={`${hour}시: ${count}개`}
              >
                <div
                  className="chart-bar w-full rounded-sm bg-primary-400 transition-colors group-hover:bg-primary-500 dark:bg-primary-500 dark:group-hover:bg-primary-400"
                  style={{
                    height: `${Math.max((count / maxHour) * 100, count > 0 ? 8 : 2)}%`,
                    minHeight: count > 0 ? '3px' : '1px',
                    opacity: count > 0 ? 1 : 0.2,
                    animationDelay: `${hour * 12}ms`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">0</span>
            <span className="text-[10px] tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">6</span>
            <span className="text-[10px] tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">12</span>
            <span className="text-[10px] tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">18</span>
            <span className="text-[10px] tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">23</span>
          </div>
        </div>

        {/* Day distribution */}
        <div>
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            {'요일별 작성 분포'}
          </h4>
          <div className="flex items-end gap-1 h-12">
            {analytics.dayDistribution.map((count, day) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1 self-stretch justify-end">
                <div
                  className={clsx(
                    'chart-bar w-full rounded-sm',
                    day === 0 || day === 6
                      ? 'bg-primary-200 dark:bg-primary-800'
                      : 'bg-primary-400 dark:bg-primary-500'
                  )}
                  style={{
                    height: `${Math.max((count / maxDay) * 100, count > 0 ? 12 : 4)}%`,
                    minHeight: count > 0 ? '3px' : '1px',
                    opacity: count > 0 ? 1 : 0.2,
                    animationDelay: `${day * 20}ms`,
                  }}
                />
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
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
              {analytics.monthlyTrend.map((item, i) => (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-1 self-stretch justify-end">
                  <div
                    className="chart-bar w-full rounded-sm bg-primary-300 dark:bg-primary-700"
                    style={{
                      height: `${Math.max((item.count / maxMonthly) * 100, 8)}%`,
                      minHeight: '3px',
                      animationDelay: `${i * 25}ms`,
                    }}
                  />
                  <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
                >
                  #{tag}
                  <span className="text-[10px] tabular-nums text-primary-400 dark:text-primary-500">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </WidgetCard>
  )
}
