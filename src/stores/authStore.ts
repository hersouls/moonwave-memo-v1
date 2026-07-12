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
import { initSync, stopSync } from '@/services/firestoreSync'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isSigningIn: boolean
  syncStatus: SyncStatus
  lastSyncTime: string | null
  error: string | null

  initialize: () => void
  login: () => Promise<void>
  logout: () => Promise<void>
  setSyncStatus: (status: SyncStatus) => void
  setLastSyncTime: (time: string) => void
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

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,
  isSigningIn: false,
  syncStatus: 'idle',
  lastSyncTime: null,
  error: null,

  initialize: () => {
    if (unsubAuth) {
      unsubAuth()
      unsubAuth = null
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
      if (firebaseUser) {
        set({ user: toAuthUser(firebaseUser), isLoading: false, isSigningIn: false, error: null, syncStatus: 'syncing' })
        try {
          await initSync(firebaseUser.uid)
          set({ syncStatus: 'synced', lastSyncTime: new Date().toISOString() })
        } catch (err) {
          console.error('Sync init failed:', err)
          stopSync()
          set({ syncStatus: 'error' })
        }
      } else {
        stopSync()
        set({ user: null, isLoading: false, syncStatus: 'idle', lastSyncTime: null })
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
      if (
        firebaseErr.code === 'auth/popup-blocked' ||
        firebaseErr.code === 'auth/popup-closed-by-user' ||
        firebaseErr.code === 'auth/cancelled-popup-request' ||
        firebaseErr.code === 'auth/internal-error'
      ) {
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
    try {
      if (Capacitor.isNativePlatform()) {
        // 네이티브 레이어 세션도 함께 종료 (signInWithGoogle의 짝)
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
        await FirebaseAuthentication.signOut().catch(() => {})
      }
      await signOut(auth)
      set({ user: null, syncStatus: 'idle', lastSyncTime: null, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그아웃에 실패했습니다.'
      set({ error: message })
    }
  },

  setSyncStatus: (status) => set({ syncStatus: status }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
}))
