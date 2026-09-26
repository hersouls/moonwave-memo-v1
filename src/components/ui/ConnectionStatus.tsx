import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'

// Every autosave now passes through a brief 'syncing' phase (the status waits for the
// server to confirm the write), so the pill only appears when syncing actually lingers.
const SYNCING_PILL_DELAY_MS = 800

export function ConnectionStatus() {
  const isOnline = useOnlineStatus()
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const [showSyncing, setShowSyncing] = useState(false)
  const [showSynced, setShowSynced] = useState(false)

  // Remember that we went offline; announce recovery only once the sync layer has really
  // confirmed everything (status transitions into 'synced'), not merely on reconnect.
  const awaitingReconnectSync = useRef(false)
  const pillWorthy = useRef(false) // a visible non-synced phase precedes the next 'synced'
  const prevStatus = useRef(syncStatus)

  useEffect(() => {
    if (!isOnline) {
      awaitingReconnectSync.current = true
      pillWorthy.current = true
    }
  }, [isOnline])

  useEffect(() => {
    if (syncStatus !== 'syncing') {
      setShowSyncing(false)
      return
    }
    const t = setTimeout(() => {
      setShowSyncing(true)
      pillWorthy.current = true
    }, SYNCING_PILL_DELAY_MS)
    return () => clearTimeout(t)
  }, [syncStatus])

  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = syncStatus
    if (syncStatus === 'idle') {
      // Signed out: nothing will be synced, so there is nothing to announce.
      awaitingReconnectSync.current = false
      pillWorthy.current = false
      return
    }
    if (syncStatus === 'error' || syncStatus === 'offline') pillWorthy.current = true
    if (syncStatus !== 'synced' || prev === 'synced') return

    if (awaitingReconnectSync.current && isOnline) {
      awaitingReconnectSync.current = false
      useToastStore.getState().showToast('온라인으로 복구되었습니다. 동기화가 완료되었습니다.', 'success')
    }
    if (pillWorthy.current) {
      pillWorthy.current = false
      setShowSynced(true)
    }
  }, [syncStatus, isOnline])

  // Show "synced" briefly then fade out
  useEffect(() => {
    if (!showSynced) return
    const t = setTimeout(() => setShowSynced(false), 2000)
    return () => clearTimeout(t)
  }, [showSynced])

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 text-xs font-medium animate-in fade-in duration-200">
        <WifiOff className="h-3.5 w-3.5" />
        <span>오프라인</span>
      </div>
    )
  }

  if (syncStatus === 'syncing' && showSyncing) {
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

  if (showSynced && syncStatus === 'synced') {
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
  const offline = !isOnline || syncStatus === 'offline'

  return (
    <div
      className="p-1"
      title={
        offline ? '오프라인' :
        syncStatus === 'syncing' ? '동기화 중...' :
        syncStatus === 'error' ? '동기화 오류' :
        syncStatus === 'synced' ? '동기화 완료' : '온라인'
      }
    >
      {offline ? (
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
