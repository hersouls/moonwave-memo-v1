import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { apiUrl } from '@/lib/apiBase'
import { isCapacitor, isElectron } from '@/services/syncFolder'
import { IcLineDownload, IcLineLoading, IcLineMoblie } from '@/mw/icons'

/** The record scripts/build-android.sh leaves beside the APK (android.json), as api/download-android.ts answers it. */
interface AndroidRecord {
  versionName: string
  builtAt: string
  sizeBytes: number
}

/** 2026.10.12(월): the day the app was built */
function builtDay(builtAt: string): string {
  const date = parseISO(builtAt)
  return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy.MM.dd(EEE)', { locale: ko })
}

/**
 * Download of the Android app (a signed APK, sideloaded). Shown in a browser — that is where a
 * phone gets it. Hidden inside the Android app itself (leaving the WebView for a download would
 * drop the app's screen) and in the desktop app.
 *
 * The file's name carries its version and build day, so it changes with every build: the button
 * goes to the server route, which reads the build's record and sends the browser to that file.
 */
export function AndroidDownloadSection() {
  const hidden = isCapacitor() || isElectron()
  const [info, setInfo] = useState<AndroidRecord | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    if (hidden) return
    let alive = true
    fetch(apiUrl('/api/download-android?info=1'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: AndroidRecord) => { if (alive) { setInfo(d); setState('ready') } })
      .catch(() => { if (alive) setState('unavailable') })
    return () => { alive = false }
  }, [hidden])

  if (hidden) return null

  const latest = info
    ? [`최신 v${info.versionName}`, builtDay(info.builtAt) && `${builtDay(info.builtAt)} 빌드`, info.sizeBytes > 0 && `${Math.round(info.sizeBytes / 1024 / 1024)} MB`].filter(Boolean).join(' · ')
    : ''

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
                {state === 'loading' && '최신 버전을 확인하고 있어요'}
                {state === 'unavailable' && '지금은 앱 정보를 읽지 못했어요. 잠시 뒤에 다시 열어 주세요.'}
                {state === 'ready' && latest}
              </div>
              <div className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">
                새 빌드가 나오면 다시 받아 덮어 설치하면 돼요.
              </div>
              <div className="text-xs mt-1 text-[var(--text-tertiary)]">
                스토어 밖에서 받는 앱이라, 설치할 때 “출처를 알 수 없는 앱” 허용을 물어봐요.
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={state !== 'ready'}
            onClick={() => window.location.assign(apiUrl('/api/download-android'))}
          >
            {state === 'loading' ? (
              <IcLineLoading size={16} className="mr-1.5 animate-spin" />
            ) : (
              <IcLineDownload size={16} className="mr-1.5" />
            )}
            내려받기
          </Button>
        </div>
      </div>
    </section>
  )
}
