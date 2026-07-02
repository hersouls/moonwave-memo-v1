import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'

export function ConnectionStatus() {
  const isOnline = useOnlineStatus()
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const [showSynced, setShowSynced] = useState(false)

  // Track previous state for reconnection detection
  const prevOnlineRef = useRef(isOnline)
  useEffect(() => {
    if (!prevOnlineRef.current && isOnline && syncStatus === 'synced') {
      useToastStore.getState().showToast('온라인으로 복구되었습니다. 동기화가 완료되었습니다.', 'success')
    }
    prevOnlineRef.current = isOnline
  }, [isOnline, syncStatus])

  // Show "synced" briefly then fade out
  useEffect(() => {
    if (syncStatus === 'synced') {
      setShowSynced(true)
      const t = setTimeout(() => setShowSynced(false), 2000)
      return () => clearTimeout(t)
    }
  }, [syncStatus])

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 text-xs font-medium animate-in fade-in duration-200">
        <WifiOff className="h-3.5 w-3.5" />
        <span>오프라인</span>
      </div>
    )
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-medium animate-in fade-in duration-200">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>동기화 중</span>
      </div>
    )
  }

  if (syncStatus === 'error') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-xs font-medium animate-in fade-in duration-200">
        <CloudOff className="h-3.5 w-3.5" />
        <span>동기화 오류</span>
      </div>
    )
  }

  if (showSynced) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 text-xs font-medium animate-save-fadeout">
        <Cloud className="h-3.5 w-3.5" />
        <span>동기화 완료</span>
      </div>
    )
  }

  return null
}

export function ConnectionStatusIcon() {
  const isOnline = useOnlineStatus()
  const syncStatus = useAuthStore((s) => s.syncStatus)

  return (
    <div
      className="p-1"
      title={
        !isOnline ? '오프라인' :
        syncStatus === 'syncing' ? '동기화 중...' :
        syncStatus === 'error' ? '동기화 오류' :
        syncStatus === 'synced' ? '동기화 완료' : '온라인'
      }
    >
      {!isOnline ? (
        <WifiOff className="h-4 w-4 text-warning-500" />
      ) : syncStatus === 'syncing' ? (
        <RefreshCw className={clsx('h-4 w-4 text-primary-500 animate-spin')} />
      ) : syncStatus === 'error' ? (
        <CloudOff className="h-4 w-4 text-danger-500" />
      ) : (
        <Wifi className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
      )}
    </div>
  )
}
