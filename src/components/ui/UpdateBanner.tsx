import { usePwaUpdateStore } from '@/stores/pwaUpdateStore'
import { Snackbar, SnackbarTextButton } from '@/mw/Snackbar'
import { IcLineDownload } from '@/mw/icons'

/** 새 판이 준비됐을 때의 알림이에요. 누를 때까지 남아 있어요. */
export function UpdateBanner() {
  const { isUpdateAvailable, applyUpdate } = usePwaUpdateStore()
  if (!isUpdateAvailable) return null

  return (
    <Snackbar
      className="memo-toast"
      role="status"
      icon="on"
      iconElement={<IcLineDownload size={20} />}
      message="새 판이 준비됐어요"
      duration={0}
      actionElement={<SnackbarTextButton onClick={applyUpdate}>바꾸기</SnackbarTextButton>}
    />
  )
}
