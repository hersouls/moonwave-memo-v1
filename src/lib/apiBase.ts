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

// ─── Authenticated calls to our AI API ─────────────────────────────

export const AI_LOGIN_REQUIRED_MESSAGE = 'AI 기능은 로그인 후 사용할 수 있어요'

/** Thrown by authedFetch when nobody is signed in — no request was sent. */
export class AuthRequiredError extends Error {
  constructor() {
    super(AI_LOGIN_REQUIRED_MESSAGE)
    this.name = 'AuthRequiredError'
  }
}

async function currentIdToken(forceRefresh = false): Promise<string | null> {
  // Lazy: apiBase is also imported by modules that must not initialise Firebase at load
  // (e.g. services/connectivity and their tests); the app has already loaded it by now.
  const { auth } = await import('@/lib/firebase')
  // At startup Firebase restores a persisted session asynchronously; until then
  // currentUser is null even for a signed-in user, so a mount-time call must wait.
  await auth.authStateReady()
  const user = auth.currentUser
  return user ? user.getIdToken(forceRefresh) : null
}

/**
 * fetch() for our server API (`/api/...` — every route that spends the server's AI keys
 * requires a Firebase login). Adds `Authorization: Bearer <Firebase ID token>`; if the
 * server still answers 401 (stale/revoked cached token) it refreshes the token once and
 * retries. Throws AuthRequiredError, without calling the server, when signed out.
 * Only for string/JSON bodies (the retry re-sends `init.body`).
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await currentIdToken()
  if (!token) throw new AuthRequiredError()

  const send = (idToken: string) => {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${idToken}`)
    return fetch(apiUrl(path), { ...init, headers })
  }

  const res = await send(token)
  if (res.status !== 401) return res
  const fresh = await currentIdToken(true).catch(() => null)
  return fresh && fresh !== token ? send(fresh) : res
}

function formatWait(sec: number): string {
  if (sec < 60) return `${sec}초`
  if (sec < 3600) return `${Math.ceil(sec / 60)}분`
  return `${Math.ceil(sec / 3600)}시간`
}

/**
 * User-facing Korean message for a non-OK response from our API. The server never relays
 * provider error text, so its own `error` string is safe to show for 5xx.
 */
export async function apiErrorMessage(res: Response): Promise<string> {
  switch (res.status) {
    case 401:
      return '로그인이 만료되었어요. 다시 로그인해 주세요'
    case 403:
      return '이 계정은 AI 기능을 사용할 수 없어요'
    case 413:
      return '입력이 너무 길어요. 내용을 줄여서 다시 시도해 주세요'
    case 429: {
      const sec = Number(res.headers.get('Retry-After'))
      return sec > 0
        ? `AI 요청이 너무 많아요. ${formatWait(sec)} 후 다시 시도해 주세요`
        : 'AI 요청이 너무 많아요. 잠시 후 다시 시도해 주세요'
    }
    default: {
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null
      return res.status >= 500 && typeof body?.error === 'string' && /[가-힣]/.test(body.error)
        ? body.error
        : `서버 오류: ${res.status}`
    }
  }
}
