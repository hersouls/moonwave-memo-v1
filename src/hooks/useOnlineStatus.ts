import { useSyncExternalStore } from 'react'
import { connectivity } from '@/services/connectivity'

/**
 * Network state for the offline banner / status pill. "Offline" is only reported after the
 * browser says so AND a reachability probe fails (see services/connectivity) — a stuck
 * `navigator.onLine` alone no longer pins the banner on.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(connectivity.subscribe, connectivity.isOnline, () => true)
}
