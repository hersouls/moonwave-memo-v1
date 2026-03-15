// Shared platform detection utilities

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

/** Detect any iOS device (iPhone, iPad, iPod) including iPad with desktop UA */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Detect iOS Safari specifically (excludes Chrome, Firefox, Edge on iOS) */
export function isIOSSafari(): boolean {
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
}

/** Detect PWA standalone mode (added to home screen) */
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

/** Check if Vibration API is supported (false on iOS) */
export function supportsVibration(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function'
}
