import { useCallback, useEffect, useState } from 'react'
import { Archive, Download, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { downloadBackup } from '@/services/backup'
import {
  deleteOrphanBackup,
  getOrphanBackupFile,
  listOrphanBackups,
  type OrphanBackupSummary,
} from '@/services/localOwner'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Local snapshots of a previous account's data, taken when a different account signed in
 * on this device (that data is never uploaded to the new account). Each can be downloaded
 * as a regular backup file; it is restored automatically if that account signs in again.
 */
export function OrphanBackupsSection() {
  const [backups, setBackups] = useState<OrphanBackupSummary[]>([])
  const [pendingDelete, setPendingDelete] = useState<OrphanBackupSummary | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  // A switch creates/consumes snapshots; re-read whenever the signed-in account changes.
  const uid = useAuthStore((s) => s.user?.uid ?? null)

  const reload = useCallback(async () => {
    try {
      setBackups(await listOrphanBackups())
    } catch (err) {
      console.error('Failed to list account backups:', err)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, uid])

  if (backups.length === 0) return null

  const handleDownload = async (b: OrphanBackupSummary) => {
    setBusyId(b.id)
    try {
      const file = await getOrphanBackupFile(b.id)
      if (!file) throw new Error('backup missing')
      downloadBackup(file, 'Memo_Previous_Account_Backup')
    } catch (err) {
      console.error('Account backup download failed:', err)
      useToastStore.getState().showToast('백업 파일을 만들지 못했습니다', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    await deleteOrphanBackup(target.id)
    await reload()
    useToastStore.getState().showToast('이전 계정 백업을 삭제했습니다', 'info')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Archive className="w-4 h-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">이전 계정 로컬 백업</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 px-1">
        다른 계정으로 로그인할 때 이 기기에 남아 있던 이전 계정의 메모는 새 계정에 올리지 않고 여기에 보관합니다.
        그 계정으로 다시 로그인하면 자동으로 복원됩니다. 내려받은 파일을 &lsquo;데이터 복원&rsquo;으로 불러오면
        그때 로그인한 계정으로 동기화되니 주의하세요.
      </p>
      <ul className="space-y-2">
        {backups.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border-subtle)] bg-zinc-50 dark:bg-zinc-800/50"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {b.ownerEmail || '이전 계정'}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(b.createdAt)} · 메모 {b.memoCount}개
                {b.unsyncedMemoCount > 0 && (
                  <span className="text-warning-700 dark:text-warning-300"> · 동기화 안 된 메모 {b.unsyncedMemoCount}개</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDownload(b)}
              disabled={busyId === b.id}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              내려받기
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(b)}
              aria-label={`${b.ownerEmail || '이전 계정'} 백업 삭제`}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="이전 계정 백업 삭제"
        description={
          pendingDelete && pendingDelete.unsyncedMemoCount > 0
            ? `동기화되지 않은 메모 ${pendingDelete.unsyncedMemoCount}개가 포함되어 있어 삭제하면 되돌릴 수 없습니다. 먼저 내려받는 것을 권장합니다.`
            : '이 기기에 보관된 이전 계정의 로컬 데이터를 삭제합니다. 클라우드에 동기화된 메모는 영향을 받지 않습니다.'
        }
        confirmText="삭제"
        variant="danger"
      />
    </div>
  )
}
