import { useEffect, useState } from 'react'
import { Monitor, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { apiUrl } from '@/lib/apiBase'
import { isCapacitor, isElectron } from '@/services/syncFolder'

interface ReleaseInfo {
  version: string
  name: string
  size: number
  publishedAt: string
}

const normalize = (v?: string) => (v ?? '').replace(/^v/i, '')

/** Numeric semver-ish compare ("1.0.10" > "1.0.9"); pre-release tags are ignored. */
function compareVersions(a: string, b: string): number {
  const pa = normalize(a).split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const pb = normalize(b).split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * In-app download of the (unsigned) Windows desktop installer, served through the
 * server-side proxy (api/download-desktop.ts) since the source repo is private. Shows the
 * latest published version and — inside the desktop app — whether an update is available.
 * Hidden on the mobile (Capacitor) shell, where a Windows .exe is irrelevant.
 */
export function DesktopDownloadSection() {
  const [info, setInfo] = useState<ReleaseInfo | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const mobile = isCapacitor()
  // Detect the desktop app by the bridge itself — older desktop builds expose an empty
  // appVersion (npm_package_version isn't set in an installed app).
  const isElectronApp = isElectron()
  const installedVersion = isElectronApp ? normalize(window.electronBridge?.appVersion) : ''

  useEffect(() => {
    if (mobile) return
    let alive = true
    fetch(apiUrl('/api/download-desktop?info=1'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ReleaseInfo) => { if (alive) { setInfo(d); setState('ready') } })
      .catch(() => { if (alive) setState('unavailable') })
    return () => { alive = false }
  }, [mobile])

  if (mobile) return null

  const sizeMB = info ? `${Math.round(info.size / 1024 / 1024)} MB` : ''
  // Unknown installed version (older build) counts as outdated.
  const hasUpdate =
    isElectronApp && info != null && (!installedVersion || compareVersions(info.version, installedVersion) > 0)

  return (
    <section>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
        데스크톱 앱 (Windows)
      </h3>
      <div className="p-5 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <Monitor className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              {isElectronApp ? (
                installedVersion ? (
                  <span>설치된 버전 <span className="tabular-nums">v{installedVersion}</span></span>
                ) : (
                  <span>설치된 버전을 확인할 수 없습니다 (이전 버전)</span>
                )
              ) : (
                'Windows용 데스크톱 앱을 내려받아 설치할 수 있습니다.'
              )}
              <div className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">
                {state === 'loading' && '최신 버전 확인 중…'}
                {state === 'unavailable' && '아직 배포된 설치본이 없습니다.'}
                {state === 'ready' && info && (
                  hasUpdate
                    ? `새 버전 v${normalize(info.version)} 있음 · ${sizeMB}`
                    : `최신 v${normalize(info.version)} · ${sizeMB}`
                )}
              </div>
              <div className="text-[11px] mt-1 text-zinc-400 dark:text-zinc-500">
                서명되지 않은 설치본입니다 — 설치 시 SmartScreen 경고가 나오면 “추가 정보 → 실행”.
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={state !== 'ready'}
            onClick={() => window.location.assign(apiUrl('/api/download-desktop?platform=win'))}
          >
            {state === 'loading' ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            {isElectronApp && hasUpdate ? '업데이트 내려받기' : '다운로드'}
          </Button>
        </div>
      </div>
    </section>
  )
}
