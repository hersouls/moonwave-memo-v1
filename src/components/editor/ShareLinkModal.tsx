import { useState, useMemo } from 'react'
import { Download, Eye, EyeOff } from 'lucide-react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { generateShareHTML } from '@/services/shareLink'
import { useToastStore } from '@/stores/toastStore'

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
    useToastStore.getState().showToast('HTML \uD30C\uC77C\uC774 \uB2E4\uC6B4\uB85C\uB4DC\uB418\uC5C8\uC2B5\uB2C8\uB2E4', 'success')
  }

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogHeader
        title={'\uB9C1\uD06C\uB85C \uACF5\uC720'}
        description={'\uBA54\uBAA8\uB97C HTML \uD30C\uC77C\uB85C \uB0B4\uBCF4\uB0B4 \uACF5\uC720\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
        onClose={onClose}
      />

      <DialogBody>
        {/* Preview toggle */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {'\uBBF8\uB9AC\uBCF4\uAE30'}
          </span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            {showPreview ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                {'\uC228\uAE30\uAE30'}
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
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
              title="Share preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          {'\uB2EB\uAE30'}
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          HTML {'\uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC'}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
