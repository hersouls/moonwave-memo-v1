import { Wifi, WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function ConnectionStatus() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium animate-in fade-in duration-200">
      <WifiOff className="h-3.5 w-3.5" />
      <span>오프라인</span>
    </div>
  )
}

export function ConnectionStatusIcon() {
  const isOnline = useOnlineStatus()

  return (
    <div
      className="p-1"
      title={isOnline ? '온라인' : '오프라인'}
    >
      {isOnline ? (
        <Wifi className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-amber-500" />
      )}
    </div>
  )
}
