import { Button } from '@/components/ui/Button'
import { isCapacitor, isElectron } from '@/services/syncFolder'
import { IcLineDownload, IcLineMoblie } from '@/mw/icons'

/** The rolling GitHub release that scripts/build-android.sh replaces with every build. */
export const ANDROID_APK_URL =
  'https://github.com/hersouls/moonwave-memo-v1/releases/download/android/moonwave-memo.apk'

/**
 * Download of the Android app (a signed APK, sideloaded). Shown in a browser — that is where a
 * phone gets it. Hidden inside the Android app itself (leaving the WebView for a download would
 * drop the app's screen) and in the desktop app.
 */
export function AndroidDownloadSection() {
  if (isCapacitor() || isElectron()) return null

  return (
    <section>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
        Android 앱
      </h3>
      <div className="p-5 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <IcLineMoblie size={20} className="text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              휴대폰에 설치하는 앱이에요. 휴대폰에서 이 화면을 열고 내려받아요.
              <div className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">
                새 빌드가 나오면 같은 파일을 다시 받아 덮어 설치하면 돼요.
              </div>
              <div className="text-[11px] mt-1 text-zinc-400 dark:text-zinc-500">
                스토어 밖에서 받는 앱이라, 설치할 때 “출처를 알 수 없는 앱” 허용을 물어봐요.
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => window.location.assign(ANDROID_APK_URL)}>
            <IcLineDownload size={16} className="mr-1.5" />
            내려받기
          </Button>
        </div>
      </div>
    </section>
  )
}
