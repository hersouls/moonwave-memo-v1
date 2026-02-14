import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { ExternalLink } from 'lucide-react'
import { MusicPlayer } from './MusicPlayer'

import { clsx } from 'clsx'

export function Footer() {
  const openTermsModal = useUIStore((state) => state.openTermsModal)
  const isMusicPlayerEnabled = useSettingsStore((state) => state.settings.isMusicPlayerEnabled)

  return (
    <footer
      className={clsx(
        "flex flex-col lg:flex-row gap-4 lg:gap-0 mt-auto py-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 justify-between items-center mb-16 lg:mb-0",
        !isMusicPlayerEnabled && "hidden lg:flex"
      )}
      role="contentinfo"
    >
      <div className="hidden lg:block flex-1" />
      <nav
        className="hidden lg:flex items-center justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 order-2 lg:order-none"
        aria-label="푸터 링크"
      >
        <span>Copyright© Moonwave All rights reserved.</span>
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
      <div className="flex-1 flex justify-center lg:justify-end w-full lg:w-auto order-1 lg:order-none">
        {isMusicPlayerEnabled && <MusicPlayer />}
      </div>
    </footer>
  )
}
