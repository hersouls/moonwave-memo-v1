import { useEffect, useMemo } from 'react'
import {
  CheckCircle,
  Circle,
  Trash2,
  Edit3,
  FolderInput,
  Flag,
  Plus,
  ListChecks,
  History,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { useActivityStore } from '@/stores/activityStore'
import type { ActivityAction, ActivityLog } from '@/lib/types'

function getActionIcon(action: ActivityAction) {
  switch (action) {
    case 'task-created': return <Plus className="w-3.5 h-3.5 text-blue-500" />
    case 'task-completed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    case 'task-uncompleted': return <Circle className="w-3.5 h-3.5 text-amber-500" />
    case 'task-deleted': return <Trash2 className="w-3.5 h-3.5 text-red-500" />
    case 'task-edited': return <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
    case 'task-moved': return <FolderInput className="w-3.5 h-3.5 text-purple-500" />
    case 'task-flagged': return <Flag className="w-3.5 h-3.5 text-red-400" />
    case 'task-unflagged': return <Flag className="w-3.5 h-3.5 text-zinc-400" />
    case 'subtask-added': return <ListChecks className="w-3.5 h-3.5 text-blue-400" />
    case 'subtask-completed': return <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
    default: return <Circle className="w-3.5 h-3.5 text-zinc-400" />
  }
}

function getActionLabel(action: ActivityAction): string {
  switch (action) {
    case 'task-created': return '작업 생성'
    case 'task-completed': return '작업 완료'
    case 'task-uncompleted': return '완료 취소'
    case 'task-deleted': return '작업 삭제'
    case 'task-edited': return '작업 수정'
    case 'task-moved': return '카테고리 이동'
    case 'task-flagged': return '깃발 설정'
    case 'task-unflagged': return '깃발 해제'
    case 'subtask-added': return '하위 작업 추가'
    case 'subtask-completed': return '하위 작업 완료'
    default: return '활동'
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatDateHeader(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return '오늘'
  if (dateStr === yesterday) return '어제'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function ActivityLogItem({ log }: { log: ActivityLog }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
        {getActionIcon(log.action)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {getActionLabel(log.action)}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {formatRelativeTime(log.createdAt)}
          </span>
        </div>
        <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
          {log.taskTitle}
        </p>
        {log.details && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{log.details}</p>
        )}
      </div>
    </div>
  )
}

export function ActivityLogPage() {
  const logs = useActivityStore((s) => s.logs)
  const loadLogs = useActivityStore((s) => s.loadLogs)
  const isLoading = useActivityStore((s) => s.isLoading)

  useEffect(() => {
    loadLogs(500)
  }, [loadLogs])

  // 날짜별 그룹핑
  const groupedLogs = useMemo(() => {
    const groups: Record<string, ActivityLog[]> = {}
    logs.forEach((log) => {
      const date = log.date
      if (!groups[date]) groups[date] = []
      groups[date].push(log)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [logs])

  return (
    <PageContainer>
      <div className="flex items-center gap-2 mb-6">
        <History className="w-5 h-5 text-primary-500" />
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">활동 기록</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groupedLogs.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <History className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm">활동 기록이 없습니다</p>
            <p className="text-xs mt-1">작업을 생성하거나 완료하면 기록됩니다</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedLogs.map(([date, dateLogs]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 sticky top-0 bg-zinc-50 dark:bg-zinc-900 py-1 z-10">
                {formatDateHeader(date)}
                <span className="ml-2 text-zinc-400 font-normal">{dateLogs.length}건</span>
              </h3>
              <Card>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {dateLogs.map((log) => (
                    <ActivityLogItem key={log.id} log={log} />
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
