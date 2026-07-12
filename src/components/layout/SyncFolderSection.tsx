import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  FolderOpen,
  HardDrive,
  Loader2,
  Check,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  Plus,
  X,
  Server,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToastStore } from '@/stores/toastStore'
import { useSyncFolderStore, type SyncFolderFormat } from '@/stores/syncFolderStore'
import {
  isSyncFolderSupported,
  isElectron,
  isCapacitor,
  pickSyncFolder,
  reconnectSyncFolder,
  disableSyncFolder,
  exportAllMemosToFolder,
  setSyncFolderFormat,
  importHtmlFiles,
  addMirrorFolder,
  removeMirrorFolder,
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
  const mirrors = useSyncFolderStore((s) => s.mirrors)
  const pendingOps = useSyncFolderStore((s) => s.pendingOps)
  const format = useSyncFolderStore((s) => s.format)
  const showToast = useToastStore((s) => s.showToast)

  const [busy, setBusy] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)
  const htmlInputRef = useRef<HTMLInputElement>(null)

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
        const result = await pickSyncFolder()
        if (result === 'picked') showToast('동기화 폴더가 연결되었습니다.', 'success')
        else if (result === 'overlaps-mirror')
          showToast('미러 폴더와 같거나 겹치는 폴더는 주 저장 폴더로 지정할 수 없습니다.', 'warning')
      } finally {
        setBusy(false)
      }
    }
  }

  const handlePickFolder = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await pickSyncFolder()
      if (result === 'picked') showToast('폴더가 변경되었습니다. 전체 내보내기로 파일을 채우세요.', 'success')
      else if (result === 'overlaps-mirror')
        showToast('미러 폴더와 같거나 겹치는 폴더는 주 저장 폴더로 지정할 수 없습니다.', 'warning')
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
      if (result.failed > 0) {
        showToast(`전체 내보내기 중 ${result.failed}건 저장 실패 — ${result.written}건만 기록됨. 폴더 연결을 확인하세요.`, 'error')
      } else {
        showToast(`전체 내보내기 완료 — ${result.written}건 기록`, 'success')
      }
    } catch {
      showToast('전체 내보내기에 실패했습니다.', 'error')
    } finally {
      setBusy(false)
      setExportProgress(null)
    }
  }

  const handleAddMirror = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await addMirrorFolder()
      if (result === 'added') showToast('미러 폴더가 추가되었습니다. 기존 파일을 복사합니다.', 'success')
      else if (result === 'duplicate')
        showToast('이미 등록된 미러 폴더와 같거나 겹치는 폴더는 추가할 수 없습니다.', 'warning')
      else if (result === 'overlaps-primary')
        showToast('주 저장 폴더와 같거나 겹치는 폴더는 미러로 지정할 수 없습니다. 별도의 폴더를 선택하세요.', 'warning')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveMirror = async (path: string) => {
    if (busy) return
    setBusy(true)
    try {
      await removeMirrorFolder(path)
      showToast('미러 폴더를 제거했습니다. 폴더의 파일은 유지됩니다.', 'info')
    } finally {
      setBusy(false)
    }
  }

  const handleFormatChange = async (fmt: SyncFolderFormat) => {
    if (busy || fmt === format) return
    setBusy(true)
    try {
      await setSyncFolderFormat(fmt)
      if (enabled) showToast('저장 형식을 변경하고 파일을 다시 내보냈습니다.', 'success')
    } finally {
      setBusy(false)
    }
  }

  const handleImportHtml = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || busy) return
    setBusy(true)
    try {
      const { imported, failed } = await importHtmlFiles(files)
      showToast(
        failed ? `${imported}건 가져옴, ${failed}건 실패` : `HTML ${imported}건을 메모로 가져왔습니다.`,
        failed ? 'warning' : 'success',
      )
    } finally {
      setBusy(false)
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
          {isElectron()
            ? ' 데스크톱 앱은 상시 접근하며 NAS 네트워크 폴더도 지정할 수 있습니다.'
            : isCapacitor()
              ? ' 폰의 문서 폴더에 저장되며, Synology Drive 등 동기화 앱으로 NAS와 연결할 수 있습니다.'
              : ' 브라우저 탭이 열려 있을 때만 동작합니다.'}
        </p>

        {/* ② 주 저장 폴더 */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">주 저장 폴더</div>
              <InfoTip
                label="주 저장 폴더 설명"
                content={
                  <div className="space-y-1 font-normal text-left leading-relaxed">
                    <p className="font-semibold">메모가 실제 파일로 저장되는 원본 폴더 (기기당 1개)</p>
                    <p>데스크톱 앱은 이 폴더를 감시해, 밖에서 파일을 고치면 앱에도 자동 반영됩니다 (양방향).</p>
                  </div>
                }
              />
            </div>
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
          {!isCapacitor() && (
            <Button variant="secondary" size="sm" onClick={handlePickFolder} disabled={busy}>
              <FolderOpen className="w-4 h-4 mr-1.5" />
              {folderName ? '폴더 변경' : '폴더 선택'}
            </Button>
          )}
        </div>

        {/* ③ 미러 폴더 (Electron 전용, NAS 등 복사 대상) */}
        {isElectron() && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                미러 폴더 <span className="text-xs font-normal text-zinc-400">(NAS·백업, 복사 전용)</span>
                <InfoTip
                  label="미러 폴더 설명"
                  content={
                    <div className="space-y-1 font-normal text-left leading-relaxed">
                      <p className="font-semibold">주 저장 폴더의 결과를 그대로 복사하는 백업 폴더 (NAS·외장, 여러 개 가능)</p>
                      <p>복사 전용(단방향): 앱이 읽지 않으므로 여기 파일을 고쳐도 반영되지 않습니다. 실패 시 자동 재시도.</p>
                      <p>주 저장 폴더와 같거나 겹치는 폴더는 지정할 수 없습니다.</p>
                    </div>
                  }
                />
              </div>
              <Button variant="secondary" size="sm" onClick={handleAddMirror} disabled={busy}>
                <Plus className="w-4 h-4 mr-1.5" />
                폴더 추가
              </Button>
            </div>
            {mirrors.length > 0 ? (
              <ul className="space-y-1">
                {mirrors.map((m) => (
                  <li
                    key={m.path}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-[var(--color-border-subtle)]"
                  >
                    <span className="min-w-0 inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                      <Server className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate" title={m.path}>{m.path}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMirror(m.path)}
                      disabled={busy}
                      aria-label={`미러 폴더 제거: ${m.name}`}
                      className="shrink-0 p-1 rounded text-zinc-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                로컬 저장 결과를 복사할 NAS·백업 폴더를 추가할 수 있습니다. 주 저장 폴더와 겹치지 않는 별도 위치여야 합니다.
              </p>
            )}
            {pendingOps > 0 && (
              <p className="text-xs text-warning-600 dark:text-warning-400">
                미러 대기 중 {pendingOps}건 — 연결되면 자동 재시도합니다.
              </p>
            )}
          </div>
        )}

        {/* ④ 저장 형식 (Phase 4: md / html / both) */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">저장 형식</div>
          <div className="flex items-center gap-1 text-xs" role="radiogroup" aria-label="저장 형식">
            {([['md', '.md'], ['html', '.html'], ['both', '둘 다']] as [SyncFolderFormat, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={format === value}
                disabled={busy}
                onClick={() => handleFormatChange(value)}
                className={[
                  'px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50',
                  format === value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'border-[var(--color-border-default)] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* HTML 가져오기 (외부 .html → 메모) */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">HTML 가져오기</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">외부 .html 파일을 정화 후 새 메모로 가져옵니다.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => htmlInputRef.current?.click()} disabled={busy}>
            <Upload className="w-4 h-4 mr-1.5" />
            파일 선택
          </Button>
          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            onChange={handleImportHtml}
            className="hidden"
          />
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

/** 라벨 옆 ⓘ 트리거 — 호버/포커스 시 상세 설명 툴팁 (버튼이라 키보드로도 열 수 있음). */
function InfoTip({ label, content }: { label: string; content: ReactNode }) {
  return (
    <Tooltip content={content} placement="bottom">
      <button
        type="button"
        aria-label={label}
        className="-my-1 inline-flex items-center justify-center w-6 h-6 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-help"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
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
