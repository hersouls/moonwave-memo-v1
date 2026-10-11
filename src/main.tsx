import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { router } from './router'
import { usePwaUpdateStore } from './stores/pwaUpdateStore'
import { initSentry } from './lib/sentry'
import { incomingRoute } from './lib/handoff'
import './index.css'

// Initialize Sentry error monitoring (no-op if DSN not configured)
initSentry()

// 설치한 PWA가 이미 열려 있을 때 Drive의 ‘Memo로 보내기’나 공유 받기로 다시 불리면, 열려던 주소를 받아 그 화면으로 가요.
// (launch_handler: focus-existing은 창만 앞으로 가져오고 주소는 바꾸지 않아요.)
const launchQueue = (window as { launchQueue?: { setConsumer(consumer: (launch: { targetURL?: string }) => void): void } }).launchQueue
launchQueue?.setConsumer(({ targetURL }) => {
  const to = incomingRoute(targetURL, window.location.origin)
  if (to && to !== window.location.pathname + window.location.search + window.location.hash) void router.navigate(to)
})

// Service Worker for PWA — skipped in the packaged shells (§4.8): Electron and
// Capacitor serve the bundle locally, so the offline SW adds nothing there and
// registering it would interfere (duplicate cache, first-launch claim() reload).
if ('serviceWorker' in navigator && !window.electronBridge && !Capacitor.isNativePlatform()) {
  if (import.meta.env.PROD) {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        // 서비스 워커를 막아 둔 브라우저에서는 등록 객체가 없어요. 오프라인 캐시 없이 그대로 써요.
        if (!registration) return

        if (registration.waiting) {
          usePwaUpdateStore.getState().showUpdate(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              usePwaUpdateStore.getState().showUpdate(newWorker)
            }
          })
        })

        registration.update()
        setInterval(() => registration.update(), 10 * 60 * 1000)

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update()
          }
        })
      } catch (error) {
        console.error('SW registration failed:', error)
      }
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }
}

// PWA Install Prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent

  // Only expose installPWA when a prompt is actually available
  ;(window as Window & { installPWA?: () => Promise<boolean> }).installPWA = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    // Remove the function so UI updates correctly
    delete (window as Window & { installPWA?: () => Promise<boolean> }).installPWA
    return outcome === 'accepted'
  }

  window.dispatchEvent(new CustomEvent('pwaInstallAvailable'))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
