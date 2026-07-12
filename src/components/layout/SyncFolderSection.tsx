import { useState } from 'react'
import {
  FolderOpen,
  HardDrive,
  Loader2,
  Check,
  RefreshCw,
  Download,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToastStore } from '@/stores/toastStore'
import { useSyncFolderStore } from '@/stores/syncFolderStore'
import {
  isSyncFolderSupported,
  isElectron,
  pickSyncFolder,
  reconnectSyncFolder,
  disableSyncFolder,
  exportAllMemosToFolder,
} from '@/services/syncFolder'

/**
 * 동기화 폴더 설정 섹션 (§6 UI/UX 명세).
 *
 * 데이터 탭의 "클라우드 동기화"와 "백업 및 복원" 사이에 배치. 설정 상태는
 * settingsStore가 아니라 기기 전용 syncFolderStore에 저장되므로 다른 기기로
 * 폴더 경로가 전파되지 않는다 (§4.8).
 */
export function SyncFolderSection() {
  const supported = isSyncFolderSupported()
  const enabled = useSyncFolderStore((s) => s.enabled)
  const folderName = useSyncFolderStore((s) => s.folderName)
  const status = useSyncFolderStore((s) => s.status)
  const lastWrittenAt = useSyncFolderStore((s) => s.lastWrittenAt)
  const fileCount = useSyncFolderStore((s) => s.fileCount)
  const errorMsg = useSyncFolderStore((s) => s.error)
  const showToast = useToastStore((s) => s.showToast)

  const [busy, setBusy] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)

  // ─── Platform gating (§6) ───
  if (!supported) {
    return (
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          동기화 폴더
        </h3>
        <div className="p-4 rounded-xl border border-[var(--color-border-subtle)] bg-zinc-50 dark:bg-zinc-900/40 opacity-70">
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              이 기기는 폴더 저장을 지원하지 않습니다 — Firebase로만 동기화됩니다.
              <div className="text-xs mt-1 text-zinc-400 dark:text-zinc-500">
                Chrome 또는 Edge 데스크톱 브라우저에서 사용할 수 있습니다.
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const handleToggle = async () => {
    if (busy) return
    if (enabled) {
      setBusy(true)
      try {
        await disableSyncFolder()
        showToast('동기화 폴더를 껐습니다. 폴더의 파일은 그대로 유지됩니다.', 'info')
      } finally {
        setBusy(false)
      }
    } else {
      // Enabling requires picking a folder (user gesture).
      setBusy(true)
      try {
        const ok = await pickSyncFolder()
        if (ok) showToast('동기화 폴더가 연결되었습니다.', 'success')
      } finally {
        setBusy(false)
      }
    }
  }

  const handlePickFolder = async () => {
    if (busy) return
    setBusy(true)
    try {
      const ok = await pickSyncFolder()
      if (ok) showToast('폴더가 변경되었습니다. 전체 내보내기로 파일을 채우세요.', 'success')
    } finally {
      setBusy(false)
    }
  }

  const handleReconnect = async () => {
    if (busy) return
    setBusy(true)
    try {
      const ok = await reconnectSyncFolder()
      if (ok) showToast('폴더 권한이 복원되었습니다.', 'success')
      else showToast('폴더 권한을 얻지 못했습니다.', 'warning')
    } finally {
      setBusy(false)
    }
  }

  const handleExportAll = async () => {
    if (busy) return
    setBusy(true)
    setExportProgress({ done: 0, total: 0 })
    try {
      const result = await exportAllMemosToFolder((p) => setExportProgress(p))
      showToast(`전체 내보내기 완료 — ${result.written}건 기록`, 'success')
    } catch {
      showToast('전체 내보내기에 실패했습니다.', 'error')
    } finally {
      setBusy(false)
      setExportProgress(null)
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return null
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          동기화 폴더
        </h3>
        {/* ① 활성화 토글 */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="동기화 폴더 켜기/끄기"
          disabled={busy}
          onClick={handleToggle}
          className={[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
            enabled ? 'bg-primary-500' : 'bg-zinc-300 dark:bg-zinc-700',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      </div>

      <div className="p-5 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 shadow-sm space-y-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          메모를 지정한 폴더에 <code className="text-[11px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">.md</code> 파일로 자동 저장합니다.
          {isElectron() ? ' 데스크톱 앱은 상시 접근하며 NAS 네트워크 폴더도 지정할 수 있습니다.' : ' 브라우저 탭이 열려 있을 때만 동작합니다.'}
        </p>

        {/* ② 주 저장 폴더 */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">주 저장 폴더</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {folderName ? (
                <span className="inline-flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" aria-hidden="true" />
                  {folderName}
                </span>
              ) : (
                '지정되지 않음'
              )}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handlePickFolder} disabled={busy}>
            <FolderOpen className="w-4 h-4 mr-1.5" />
            {folderName ? '폴더 변경' : '폴더 선택'}
          </Button>
        </div>

        {/* ④ 저장 형식 (Phase 1은 .md만) */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">저장 형식</div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100">
              <span className="w-3 h-3 rounded-full border-4 border-primary-500" /> .md
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">
              .html · 둘 다 <span className="opacity-70">(Phase 4)</span>
            </span>
          </div>
        </div>

        {/* ⑤ 상태 배지 */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">상태:</span>
            <StatusBadge status={status} enabled={enabled} />
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {enabled && lastWrittenAt && formatTime(lastWrittenAt) && (
              <span>{formatTime(lastWrittenAt)} · </span>
            )}
            {enabled && <span>파일 {fileCount}개</span>}
          </div>
        </div>

        {/* 권한 재요청 (needs-permission) */}
        {status === 'needs-permission' && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800">
            <span className="text-xs text-warning-700 dark:text-warning-300">
              폴더 접근 권한이 필요합니다.
            </span>
            <Button variant="secondary" size="sm" onClick={handleReconnect} disabled={busy}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              폴더 다시 연결
            </Button>
          </div>
        )}

        {/* 오류 */}
        {status === 'error' && errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/10 border border-danger-200 dark:border-danger-800">
            <AlertTriangle className="w-4 h-4 text-danger-600 dark:text-danger-400 shrink-0 mt-0.5" />
            <span className="text-xs text-danger-600 dark:text-danger-400">{errorMsg}</span>
          </div>
        )}

        {/* ⑥ 전체 내보내기 */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {exportProgress
              ? `내보내는 중… ${exportProgress.done}/${exportProgress.total}`
              : '기존 메모 전부를 폴더에 파일로 채웁니다.'}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportAll}
            disabled={busy || !enabled || !folderName}
          >
            {busy && exportProgress ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            지금 전체 내보내기
          </Button>
        </div>
      </div>
    </section>
  )
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) {
    return <span className="text-xs text-zinc-400 dark:text-zinc-500">꺼짐</span>
  }
  switch (status) {
    case 'writing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
          <Loader2 className="w-3 h-3 animate-spin" /> 저장 중…
        </span>
      )
    case 'queued':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          대기 중
        </span>
      )
    case 'needs-permission':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300">
          권한 필요
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
          오류
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300">
          <Check className="w-3 h-3" /> 저장됨
        </span>
      )
  }
}
