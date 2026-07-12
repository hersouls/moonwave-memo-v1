/**
 * Base origin for server-proxied endpoints (Vercel /api).
 *
 * On the web (and Electron, which loads the hosted site) the app runs on the deploy
 * origin, so relative '/api/...' paths work as-is. In the packaged Capacitor APK the
 * origin is the local WebView server (https://localhost) where no /api exists — those
 * requests must target the deployed host explicitly. The api/ handlers allow the
 * WebView origin via CORS (api/lib/cors.ts).
 */
import { Capacitor } from '@capacitor/core'

const PROD_API_ORIGIN = 'https://memo.moonwave.kr'

export const API_ORIGIN: string = Capacitor.isNativePlatform()
  ? ((import.meta.env.VITE_API_ORIGIN as string | undefined) ?? PROD_API_ORIGIN)
  : ''

/** Prefix a server API path ('/api/...') with the platform-appropriate origin. */
export function apiUrl(path: string): string {
  return path.startsWith('/') ? API_ORIGIN + path : path
}
