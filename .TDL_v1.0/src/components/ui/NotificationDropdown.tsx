// ============================================
// Notification Dropdown Component
// TDL_v1.0 - Task Notifications
// ============================================

import { useNotificationStore, useUnreadCount } from '@/stores/notificationStore'
import type { AppNotification, NotificationType } from '@/lib/types'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Tooltip } from './Tooltip'
import { clsx } from 'clsx'
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  Database,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

// Type-specific icon and color mapping
const typeConfig: Record<
  NotificationType,
  { icon: LucideIcon; colorClass: string; bgClass: string }
> = {
  'task-due': {
    icon: Clock,
    colorClass: 'text-primary-500',
    bgClass: 'bg-primary-100 dark:bg-primary-900/30',
  },
  'task-overdue': {
    icon: AlertTriangle,
    colorClass: 'text-rose-500',
    bgClass: 'bg-rose-100 dark:bg-rose-900/30',
  },
  'task-reminder': {
    icon: Bell,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  'backup-reminder': {
    icon: Database,
    colorClass: 'text-zinc-500',
    bgClass: 'bg-zinc-100 dark:bg-zinc-800',
  },
  'streak-milestone': {
    icon: Star,
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
}

// Relative time formatter
function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  return new Date(date).toLocaleDateString('ko-KR')
}

interface NotificationItemProps {
  notification: AppNotification
  onClose: () => void
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const navigate = useNavigate()
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const removeNotification = useNotificationStore((state) => state.removeNotification)

  const config = typeConfig[notification.type]
  const Icon = config.icon

  const handleClick = () => {
    markAsRead(notification.id)

    if (notification.taskId) {
      navigate(`/task/${notification.taskId}`)
    }

    onClose()
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeNotification(notification.id)
  }

  return (
    <div
      role="listitem"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      tabIndex={0}
      className={clsx(
        'group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
        notification.read
          ? 'bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
          : 'bg-primary-50/50 dark:bg-primary-900/10 hover:bg-primary-50 dark:hover:bg-primary-900/20'
      )}
      aria-label={`${notification.title}: ${notification.message}${notification.read ? '' : ' (읽지 않음)'}`}
    >
      {/* Icon */}
      <div className={clsx('flex-shrink-0 p-2 rounded-full', config.bgClass)} aria-hidden="true">
        <Icon className={clsx('w-4 h-4', config.colorClass)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'text-sm font-medium truncate',
            notification.read
              ? 'text-zinc-700 dark:text-zinc-300'
              : 'text-zinc-900 dark:text-zinc-100'
          )}
        >
          {notification.title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary-500" />
      )}

      {/* Remove button (visible on hover) */}
      <button
        onClick={handleRemove}
        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-opacity"
        aria-label="알림 삭제"
      >
        <X className="w-3 h-3 text-zinc-500" />
      </button>
    </div>
  )
}

export function NotificationDropdown() {
  const notifications = useNotificationStore((state) => state.notifications)
  const unreadCount = useUnreadCount()
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead)
  const clearAll = useNotificationStore((state) => state.clearAll)

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          {/* Trigger Button */}
          <PopoverButton
            className="relative p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 읽지 않음` : '알림'}
            aria-haspopup="dialog"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                aria-hidden="true"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </PopoverButton>

          {/* Dropdown Panel */}
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel
              className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 z-50 mt-2 sm:w-96 origin-top-right rounded-xl bg-white dark:bg-zinc-900 shadow-lg dark:shadow-zinc-900/50 ring-1 ring-zinc-200 dark:ring-zinc-700 focus:outline-none"
              role="dialog"
              aria-labelledby="notification-panel-title"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
                <h3
                  id="notification-panel-title"
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  알림
                  {unreadCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {unreadCount}개 읽지 않음
                    </span>
                  )}
                </h3>
                {notifications.length > 0 && (
                  <Tooltip content="모든 알림 읽음 처리" placement="bottom">
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                      aria-label="모든 알림 읽음으로 표시"
                    >
                      <Check className="w-3 h-3" aria-hidden="true" />
                      전체 읽음
                    </button>
                  </Tooltip>
                )}
              </div>

              {/* Notification List */}
              <div
                className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800"
                role="list"
                aria-label="알림 목록"
              >
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClose={close}
                    />
                  ))
                ) : (
                  <div className="py-12 text-center" role="status">
                    <Bell
                      className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">알림이 없습니다</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700">
                  <Tooltip content="모든 알림 삭제" placement="top">
                    <button
                      onClick={clearAll}
                      className="flex items-center justify-center gap-1 w-full py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                      aria-label="모든 알림 삭제"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      전체 삭제
                    </button>
                  </Tooltip>
                </div>
              )}
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
