import { AppHistory, AppInstall, useAppRelease } from '@/mw/AppInstall'
import { isCapacitor, isElectron } from '@/services/syncFolder'

/** The installed app's version, from the bridge MainActivity adds to its WebView. Null in a browser. */
function installedApp(): { versionName?: string; versionCode: number } | null {
  const bridge = (window as { MoonwaveApp?: { versionCode(): number; versionName(): string } }).MoonwaveApp
  if (!bridge) return null
  try {
    return { versionCode: bridge.versionCode(), versionName: bridge.versionName() }
  } catch {
    return null
  }
}

/**
 * Settings › Android 앱: the kit's AppInstall (the version on offer, its build day, the installed one, whether an
 * update is needed) and AppHistory. The records are /app/version.json and /app/history.json, which api/download-android.ts
 * answers from the build's record on the release; a file is received through that route by name.
 * Hidden in the desktop app.
 */
export function AndroidDownloadSection() {
  const { release, history, loading, error, reload } = useAppRelease('/app')
  if (isElectron()) return null
  const installed = isCapacitor() ? installedApp() : null
  return (
    <div className="mw-settings">
      <AppInstall name="Memo" release={release} installed={installed} loading={loading} error={error} onRetry={reload} />
      <AppHistory history={history} installed={installed} name="memo:app-history" />
    </div>
  )
}
