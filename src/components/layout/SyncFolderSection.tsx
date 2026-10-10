import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
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
  syncFolderStructure,
  setSyncFolderFormat,
  importHtmlFiles,
  addMirrorFolder,
  removeMirrorFolder,
} from '@/services/syncFolder'
import { IcLineAdd, IcLineCheck, IcLineClose, IcLineDownload, IcLineFolder, IcLineInfo, IcLineLoading, IcLineRefresh, IcLineWarning, IcMwDrive, IcMwServer, IcMwUpload } from '@/mw/icons'

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
            <IcMwDrive size={20} className="text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              이 기기에서는 폴더에 저장할 수 없어요. Firebase로만 동기화해요.
              <div className="text-xs mt-1 text-[var(--text-tertiary)]">
                Chrome이나 Edge 데스크톱 브라우저에서 쓸 수 있어요.
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
        showToast('동기화 폴더를 껐어요. 폴더의 파일은 그대로 남아요.', 'info')
      } finally {
        setBusy(false)
      }
    } else {
      // Enabling requires picking a folder (user gesture).
      setBusy(true)
      try {
        const result = await pickSyncFolder()
        if (result === 'picked') showToast('동기화 폴더를 연결했어요.', 'success')
        else if (result === 'overlaps-mirror')
          showToast('미러 폴더와 같거나 겹치는 폴더는 주 저장 폴더로 정할 수 없어요.', 'warning')
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
      if (result === 'picked') showToast('폴더를 바꿨어요. 전체 내보내기로 파일을 채워 주세요.', 'success')
      else if (result === 'overlaps-mirror')
        showToast('미러 폴더와 같거나 겹치는 폴더는 주 저장 폴더로 정할 수 없어요.', 'warning')
    } finally {
      setBusy(false)
    }
  }

  const handleReconnect = async () => {
    if (busy) return
    setBusy(true)
    try {
      const ok = await reconnectSyncFolder()
      if (ok) showToast('폴더 권한을 다시 받았어요.', 'success')
      else showToast('폴더 권한을 받지 못했어요. 다시 연결해 권한을 허용해 주세요.', 'warning')
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
        showToast(`전체 내보내기에서 ${result.failed}건을 저장하지 못했어요. ${result.written}건만 기록했어요. 폴더 연결을 확인해 주세요.`, 'error')
      } else {
        showToast(`전체 내보내기를 마쳤어요. ${result.written}건을 기록했어요.`, 'success')
      }
    } catch {
      showToast('전체 내보내기를 하지 못했어요. 폴더 연결을 확인해 주세요.', 'error')
    } finally {
      setBusy(false)
      setExportProgress(null)
    }
  }

  const handleSyncStructure = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { folders } = await syncFolderStructure()
      showToast(`폴더 구조를 동기화했어요. 폴더 ${folders}개를 디스크에 반영했어요.`, 'success')
    } catch {
      showToast('폴더 구조를 동기화하지 못했어요. 다시 시도해 주세요.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleAddMirror = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await addMirrorFolder()
      if (result === 'added') showToast('미러 폴더를 추가했어요. 기존 파일을 복사해요.', 'success')
      else if (result === 'duplicate')
        showToast('이미 등록한 미러 폴더와 같거나 겹치는 폴더는 추가할 수 없어요.', 'warning')
      else if (result === 'overlaps-primary')
        showToast('주 저장 폴더와 같거나 겹치는 폴더는 미러로 정할 수 없어요. 다른 폴더를 골라 주세요.', 'warning')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveMirror = async (path: string) => {
    if (busy) return
    setBusy(true)
    try {
      await removeMirrorFolder(path)
      showToast('미러 폴더를 뺐어요. 폴더의 파일은 그대로 남아요.', 'info')
    } finally {
      setBusy(false)
    }
  }

  const handleFormatChange = async (fmt: SyncFolderFormat) => {
    if (busy || fmt === format) return
    setBusy(true)
    try {
      await setSyncFolderFormat(fmt)
      if (enabled) showToast('저장 형식을 바꾸고 파일을 다시 내보냈어요.', 'success')
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
        failed ? `${imported}건을 가져왔고, ${failed}건은 가져오지 못했어요.` : `HTML ${imported}건을 메모로 가져왔어요.`,
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
          className={`mw-switch mw-switch--medium${enabled ? ' mw-switch--checked' : ''}`}
        >
          <div className="mw-switch__container"><div className="mw-switch__handle" /></div>
        </button>
      </div>

      <div className="p-5 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 shadow-sm space-y-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          메모를 지정한 폴더에 <code className="text-xs px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">.md</code> 파일로 자동 저장해요.
          {isElectron()
            ? ' 데스크톱 앱은 폴더에 늘 접근할 수 있고, NAS 네트워크 폴더도 정할 수 있어요.'
            : isCapacitor()
              ? ' 폰의 문서 폴더에 저장하고, Synology Drive 같은 동기화 앱으로 NAS와 연결할 수 있어요.'
              : ' 브라우저 탭이 열려 있을 때만 동작해요.'}
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
                    <p className="font-semibold">메모를 실제 파일로 저장하는 원본 폴더예요 (기기당 1개)</p>
                    <p>데스크톱 앱은 이 폴더를 지켜보다가, 밖에서 파일을 고치면 앱에도 자동으로 반영해요 (양방향).</p>
                  </div>
                }
              />
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {folderName ? (
                <span className="inline-flex items-center gap-1">
                  <IcLineFolder size={12} aria-hidden="true" />
                  {folderName}
                </span>
              ) : (
                '아직 정하지 않았어요'
              )}
            </div>
          </div>
          {!isCapacitor() && (
            <Button variant="secondary" size="sm" onClick={handlePickFolder} disabled={busy}>
              <IcLineFolder size={16} className="mr-1.5" />
              {folderName ? '폴더 변경' : '폴더 선택'}
            </Button>
          )}
        </div>

        {/* ③ 미러 폴더 (Electron 전용, NAS 등 복사 대상) */}
        {isElectron() && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                미러 폴더 <span className="text-xs font-normal text-[var(--text-tertiary)]">(NAS·백업, 복사 전용)</span>
                <InfoTip
                  label="미러 폴더 설명"
                  content={
                    <div className="space-y-1 font-normal text-left leading-relaxed">
                      <p className="font-semibold">주 저장 폴더의 결과를 그대로 복사하는 백업 폴더예요 (NAS·외장, 여러 개 가능)</p>
                      <p>복사 전용(단방향): 앱이 읽지 않아서 여기 파일을 고쳐도 반영되지 않아요. 복사하지 못하면 자동으로 다시 시도해요.</p>
                      <p>주 저장 폴더와 같거나 겹치는 폴더는 정할 수 없어요.</p>
                    </div>
                  }
                />
              </div>
              <Button variant="secondary" size="sm" onClick={handleAddMirror} disabled={busy}>
                <IcLineAdd size={16} className="mr-1.5" />
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
                      <IcMwServer size={12} className="shrink-0" aria-hidden="true" />
                      <span className="truncate" title={m.path}>{m.path}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMirror(m.path)}
                      disabled={busy}
                      aria-label={`미러 폴더 빼기: ${m.name}`}
                      className="mw-icon-button shrink-0"
                    >
                      <IcLineClose size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">
                로컬 저장 결과를 복사할 NAS·백업 폴더를 추가할 수 있어요. 주 저장 폴더와 겹치지 않는 다른 위치여야 해요.
              </p>
            )}
            {pendingOps > 0 && (
              <p className="text-xs text-warning-600 dark:text-warning-400">
                미러 복사 {pendingOps}건이 기다리고 있어요. 연결되면 자동으로 다시 시도해요.
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
                    ? 'border-primary-500 bg-primary-50 text-primary-700 '
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
            <div className="text-xs text-zinc-500 dark:text-zinc-400">외부 .html 파일을 안전하게 정리한 뒤 새 메모로 가져와요.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => htmlInputRef.current?.click()} disabled={busy}>
            <IcMwUpload size={16} className="mr-1.5" />
            파일 고르기
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
              폴더 접근 권한이 필요해요.
            </span>
            <Button variant="secondary" size="sm" onClick={handleReconnect} disabled={busy}>
              <IcLineRefresh size={16} className="mr-1.5" />
              폴더 다시 연결
            </Button>
          </div>
        )}

        {/* 오류 */}
        {status === 'error' && errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/10 border border-danger-200 dark:border-danger-800">
            <IcLineWarning size={16} className="text-danger-600 dark:text-danger-400 shrink-0 mt-0.5" />
            <span className="text-xs text-danger-600 dark:text-danger-400">{errorMsg}</span>
          </div>
        )}

        {/* ⑥ 폴더 구조 동기화 — 앱의 모든 폴더를 디스크에 디렉터리로 생성(빈 폴더 포함) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">폴더 구조 동기화</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              앱의 모든 폴더를 디스크에 폴더로 만들어요(빈 폴더 포함). 파일과 외부 폴더는 건드리지 않아요.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncStructure}
            disabled={busy || !enabled || !folderName}
          >
            <IcLineFolder size={16} className="mr-1.5" />
            폴더 동기화
          </Button>
        </div>

        {/* ⑦ 전체 내보내기 */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {exportProgress
              ? `내보내고 있어요 ${exportProgress.done}/${exportProgress.total}`
              : '기존 메모와 폴더 구조를 모두 폴더에 채워요.'}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportAll}
            disabled={busy || !enabled || !folderName}
          >
            {busy && exportProgress ? (
              <IcLineLoading size={16} className="mr-1.5 animate-spin" />
            ) : (
              <IcLineDownload size={16} className="mr-1.5" />
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
        className="mw-icon-button -my-1"
      >
        <IcLineInfo size={16} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) {
    return <span className="text-xs text-[var(--text-tertiary)]">꺼짐</span>
  }
  switch (status) {
    case 'writing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 ">
          <IcLineLoading size={12} className="animate-spin" /> 저장 중…
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
          <IcLineCheck size={12} /> 저장됨
        </span>
      )
  }
}
