import { useState, useMemo } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { generateShareHTML } from '@/services/shareLink'
import { useToastStore } from '@/stores/toastStore'
import { IcLineDownload, IcLineEye, IcLineEyeHidden } from '@/mw/icons'

interface ShareLinkModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  body: string
  tags: string[]
}

export function ShareLinkModal({ isOpen, onClose, title, body, tags }: ShareLinkModalProps) {
  const [showPreview, setShowPreview] = useState(true)

  const htmlContent = useMemo(
    () => generateShareHTML(title, body, tags),
    [title, body, tags]
  )

  const handleDownload = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'memo'}.html`
    a.click()
    URL.revokeObjectURL(url)
    useToastStore.getState().showToast('HTML 파일을 내려받았어요', 'success')
  }

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogHeader
        title={'\uB9C1\uD06C\uB85C \uACF5\uC720'}
        description={'메모를 HTML 파일로 내보내 공유할 수 있어요.'}
        onClose={onClose}
      />

      <DialogBody>
        {/* Preview toggle */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {'\uBBF8\uB9AC\uBCF4\uAE30'}
          </span>
          <button type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="mw-button mw-button--tertiary-subtle mw-button--medium"
          >
            {showPreview ? (
              <>
                <IcLineEyeHidden size={16} />
                {'\uC228\uAE30\uAE30'}
              </>
            ) : (
              <>
                <IcLineEye size={16} />
                {'\uBCF4\uAE30'}
              </>
            )}
          </button>
        </div>

        {showPreview && (
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white">
            <iframe
              srcDoc={htmlContent}
              className="w-full h-[300px] border-0"
              title="공유 미리보기"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <button type="button"
          onClick={onClose}
          className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
        >
          <span>{'\uB2EB\uAE30'}</span>
        </button>
        <button type="button"
          onClick={handleDownload}
          className="mw-button mw-button--primary mw-button--medium"
        >
          <IcLineDownload size={16} />
          HTML {'파일 내려받기'}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
