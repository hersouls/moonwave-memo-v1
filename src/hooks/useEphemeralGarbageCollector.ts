import { useEffect } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'

const GC_INTERVAL_MS = 60_000 // 60 seconds

export function useEphemeralGarbageCollector(): void {
  const ephemeralEnabled = useSettingsStore(
    (s) => s.settings.livingWorkspace.ephemeralBrainDumpEnabled
  )

  useEffect(() => {
    if (!ephemeralEnabled) return

    const collect = () => {
      const now = Date.now()
      const memos = useMemoStore.getState().memos
      const softDelete = useMemoStore.getState().softDelete

      const expired = memos.filter(
        (m) =>
          m.ephemeralExpiresAt &&
          !m.deletedAt &&
          new Date(m.ephemeralExpiresAt).getTime() <= now
      )

      if (expired.length === 0) return

      expired.forEach((m) => {
        if (m.id) {
          softDelete(m.id)
        }
      })

      useToastStore.getState().showToast(
        `임시 메모 ${expired.length}개가 만료되어 삭제되었습니다`,
        'info'
      )
    }

    // Run immediately on mount
    collect()

    const interval = setInterval(collect, GC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [ephemeralEnabled])
}
