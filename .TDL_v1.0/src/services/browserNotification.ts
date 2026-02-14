// ============================================
// Browser Notification Service
// For PWA push notifications when app opens
// ============================================

type PermissionStatus = NotificationPermission | 'unsupported'

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): PermissionStatus {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Request notification permission from user
 * @returns true if permission granted
 */
export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

interface BrowserNotificationOptions {
  taskId?: number
  tag?: string // For deduplication
}

/**
 * Show a browser notification
 * Requires permission to be granted first
 */
export function showBrowserNotification(
  title: string,
  body: string,
  options?: BrowserNotificationOptions
): void {
  if (Notification.permission !== 'granted') return

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: options?.tag || `todo-${Date.now()}`,
      data: {
        taskId: options?.taskId,
        url: options?.taskId ? `/task/${options.taskId}` : '/',
      },
      requireInteraction: false,
    })

    notification.onclick = (event) => {
      event.preventDefault()
      const data = (event.target as Notification).data
      window.focus()
      if (data?.url) {
        window.location.href = data.url
      }
      notification.close()
    }
  } catch {
    // Notification failed (e.g., unsupported on this platform)
  }
}
