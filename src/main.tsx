import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { usePwaUpdateStore } from './stores/pwaUpdateStore'
import { initSentry } from './lib/sentry'
import './index.css'

// Initialize Sentry error monitoring (no-op if DSN not configured)
initSentry()

// Service Worker for PWA
if ('serviceWorker' in navigator) {
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
