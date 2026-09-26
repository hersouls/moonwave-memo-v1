import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { auth } from '@/lib/firebase'
import type { AuthUser, SyncStatus } from '@/lib/types'
import { initSync, stopSync, flushPendingBeforeSignOut } from '@/services/firestoreSync'
import { getSyncStatus, subscribeSyncStatus } from '@/services/syncStatus'
import { useToastStore } from '@/stores/toastStore'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isSigningIn: boolean
  isSigningOut: boolean
  /** Mirrors services/syncStatus — derived from real sync signals, not set by hand. */
  syncStatus: SyncStatus
  lastSyncTime: string | null
  error: string | null

  initialize: () => void
  login: () => Promise<void>
  logout: () => Promise<void>
}

// Sign-in sync that failed (e.g. the initial merge could not reach the server) is retried
// with capped backoff while the same account stays signed in.
const INIT_RETRY_BASE_MS = 5_000
const INIT_RETRY_MAX_MS = 5 * 60_000
let initRetryTimer: ReturnType<typeof setTimeout> | null = null

function clearInitRetry() {
  if (initRetryTimer) {
    clearTimeout(initRetryTimer)
    initRetryTimer = null
  }
}

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    email: u.email || '',
    displayName: u.displayName || '',
    photoURL: u.photoURL || '',
  }
}

let unsubAuth: (() => void) | null = null
let unsubSyncStatus: (() => void) | null = null

async function startSync(user: User, attempt: number): Promise<void> {
  try {
    await initSync(user.uid, { email: user.email ?? undefined })
  } catch (err) {
    console.error('Sync init failed:', err)
    // initSync can take seconds (initial merge). If the user logged out or switched
    // accounts meanwhile, this stale continuation must not touch the new session.
    if (auth.currentUser?.uid !== user.uid) return
    stopSync({ failed: true })
    const delay = Math.min(INIT_RETRY_BASE_MS * 2 ** attempt, INIT_RETRY_MAX_MS)
    clearInitRetry()
    initRetryTimer = setTimeout(() => {
      initRetryTimer = null
      if (auth.currentUser?.uid === user.uid) void startSync(user, attempt + 1)
    }, delay)
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,
  isSigningIn: false,
  isSigningOut: false,
  syncStatus: getSyncStatus().status,
  lastSyncTime: getSyncStatus().lastSyncTime,
  error: null,

  initialize: () => {
    if (unsubAuth) {
      unsubAuth()
      unsubAuth = null
    }
    if (!unsubSyncStatus) {
      unsubSyncStatus = subscribeSyncStatus(({ status, lastSyncTime }) => set({ syncStatus: status, lastSyncTime }))
    }

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          set({ isSigningIn: false })
        }
      })
      .catch((err) => {
        console.error('Redirect result error:', err)
        set({
          isSigningIn: false,
          error: 'Google 로그인에 실패했습니다. 다시 시도해주세요.',
        })
      })

    unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      clearInitRetry()
      if (firebaseUser) {
        set({ user: toAuthUser(firebaseUser), isLoading: false, isSigningIn: false, error: null })
        // Status ('syncing' → 'synced'/'error'/'offline') is driven by the sync layer.
        await startSync(firebaseUser, 0)
      } else {
        stopSync()
        set({ user: null, isLoading: false })
      }
    })
  },

  login: async () => {
    const provider = new GoogleAuthProvider()
    set({ error: null, isSigningIn: true })

    // APK(Capacitor): WebView에서는 Google이 popup/redirect를 차단하므로
    // 네이티브 Google Sign-In으로 ID 토큰을 받아 웹 SDK 세션에 브리지한다.
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
        const result = await FirebaseAuthentication.signInWithGoogle()
        const idToken = result.credential?.idToken
        if (!idToken) throw new Error('Google 로그인이 취소되었습니다.')
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
      } catch (err) {
        const message = err instanceof Error ? err.message : '로그인에 실패했습니다.'
        // 사용자가 로그인 시트를 닫은 경우는 오류로 표시하지 않는다.
        const canceled = /cancel/i.test(message)
        set({ error: canceled ? null : message, isSigningIn: false })
      }
      return
    }

    try {
      await signInWithPopup(auth, provider)
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string }
      // User explicitly dismissed the popup — treat as a silent cancel, NOT a reason to
      // navigate the whole app away to Google (which would discard unsaved editor state).
      if (
        firebaseErr.code === 'auth/popup-closed-by-user' ||
        firebaseErr.code === 'auth/cancelled-popup-request'
      ) {
        set({ isSigningIn: false, error: null })
      } else if (
        firebaseErr.code === 'auth/popup-blocked' ||
        firebaseErr.code === 'auth/internal-error'
      ) {
        // Popup genuinely couldn't open (blocker / webview) → fall back to redirect.
        try {
          await signInWithRedirect(auth, provider)
          return
        } catch (redirectErr) {
          const message = redirectErr instanceof Error ? redirectErr.message : '로그인에 실패했습니다.'
          set({ error: message, isSigningIn: false })
        }
      } else {
        const message = err instanceof Error ? err.message : '로그인에 실패했습니다.'
        set({ error: message, isSigningIn: false })
      }
    }
  },

  logout: async () => {
    set({ isSigningOut: true })
    try {
      // Deliver what we can while still authenticated. Anything left stays queued for
      // this account on this device (never for whoever signs in next).
      const leftover = await flushPendingBeforeSignOut().catch(() => ({ queued: 0, unconfirmed: true }))
      if (Capacitor.isNativePlatform()) {
        // 네이티브 레이어 세션도 함께 종료 (signInWithGoogle의 짝)
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
        await FirebaseAuthentication.signOut().catch(() => {})
      }
      await signOut(auth)
      set({ user: null, error: null })
      if (leftover.queued > 0 || leftover.unconfirmed) {
        useToastStore.getState().showToast(
          '아직 클라우드에 올라가지 않은 변경사항은 이 기기에 보관됩니다. 같은 계정으로 다시 로그인하면 동기화됩니다.',
          'warning',
          { duration: 8000 },
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그아웃에 실패했습니다.'
      set({ error: message })
    } finally {
      set({ isSigningOut: false })
    }
  },
}))
