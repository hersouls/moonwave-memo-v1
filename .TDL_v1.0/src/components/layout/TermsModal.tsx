import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'
import { TERMS_DATA, PRIVACY_POLICY_DATA } from './TermsData'

export function TermsModal() {
  const isOpen = useUIStore((state) => state.isTermsModalOpen)
  const onClose = useUIStore((state) => state.closeTermsModal)

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogHeader title="서비스 이용약관" onClose={onClose} />
      <DialogBody className="max-h-[70dvh] overflow-y-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 pr-2">
          {/* Terms of Service Section */}
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              To-Do List 서비스 이용약관
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">시행일: 2026년 2월 1일</p>

            <div className="space-y-6">
              {TERMS_DATA.map((section, index) => (
                <div key={`terms-${index}`}>
                  <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.content.map((text, i) => (
                      <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 list-none leading-relaxed">
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          {/* Privacy Policy Section */}
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              To-Do List 개인정보처리방침
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">시행일: 2026년 2월 1일</p>

            <div className="space-y-6">
              {PRIVACY_POLICY_DATA.map((section, index) => (
                <div key={`privacy-${index}`}>
                  <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.content.map((text, i) => (
                      <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 list-none leading-relaxed">
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="primary" onClick={onClose}>
          확인
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
