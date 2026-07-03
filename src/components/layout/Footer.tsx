import { useUIStore } from '@/stores/uiStore'
import { ExternalLink } from 'lucide-react'

export function Footer() {
  const openTermsModal = useUIStore((state) => state.openTermsModal)

  return (
    <footer
      className="hidden lg:flex flex-col lg:flex-row gap-4 lg:gap-0 mt-auto py-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-[color-mix(in_srgb,var(--color-bg-elevated)_50%,transparent)] justify-between items-center"
      role="contentinfo"
    >
      <div className="hidden lg:block flex-1" />
      <nav
        className="hidden lg:flex items-center justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 order-2 lg:order-none"
        aria-label="푸터 링크"
      >
        <span>Copyright&copy; Moonwave All rights reserved.</span>
        <span aria-hidden="true">|</span>
        <button
          onClick={openTermsModal}
          className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
          aria-label="서비스 약관 열기"
        >
          Terms Of Service
        </button>
        <span aria-hidden="true">|</span>
        <a
          href="mailto:her_soul@naver.com"
          className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
          aria-label="문의하기"
        >
          Contact
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </nav>
      <div className="flex-1" />
    </footer>
  )
}
