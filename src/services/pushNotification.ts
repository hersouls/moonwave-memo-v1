import { doc, setDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useToastStore } from '@/stores/toastStore'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function registerFCMToken(userId: string): Promise<string | null> {
  try {
    const { getMessaging, getToken } = await import('firebase/messaging')
    const { app } = await import('@/lib/firebase')
    const messaging = getMessaging(app)

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      console.warn('VITE_FIREBASE_VAPID_KEY not set, skipping FCM registration')
      return null
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    })

    if (token) {
      await setDoc(
        doc(firestore, `users/${userId}/meta`, 'fcm'),
        { token, updatedAt: new Date().toISOString(), platform: getPlatform() },
        { merge: true },
      )
      return token
    }
    return null
  } catch (err) {
    console.error('FCM token registration failed:', err)
    return null
  }
}

export async function setupForegroundMessages(): Promise<void> {
  try {
    const { getMessaging, onMessage } = await import('firebase/messaging')
    const { app } = await import('@/lib/firebase')
    const messaging = getMessaging(app)

    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification ?? {}
      if (title || body) {
        useToastStore.getState().showToast(body || title || '새 알림', 'info', { duration: 5000 })
      }
    })
  } catch {
    // Firebase Messaging not supported in this environment
  }
}

function getPlatform(): string {
  if (/Android/.test(navigator.userAgent)) return 'android'
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'ios'
  return 'web'
}
