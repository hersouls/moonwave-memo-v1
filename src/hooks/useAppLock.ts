import { create } from 'zustand'
import { useSettingsStore } from '@/stores/settingsStore'

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

interface AppLockState {
  isLocked: boolean
  isAuthenticating: boolean
  lock: () => void
  unlock: () => Promise<boolean>
  registerCredential: () => Promise<boolean>
}

export const useAppLockStore = create<AppLockState>((set) => ({
  isLocked: false,
  isAuthenticating: false,

  lock: () => set({ isLocked: true }),

  unlock: async () => {
    set({ isAuthenticating: true })
    try {
      const appLock = useSettingsStore.getState().settings.appLock
      if (!appLock?.credentialId) {
        set({ isLocked: false, isAuthenticating: false })
        return true
      }

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{
            id: base64ToBuffer(appLock.credentialId),
            type: 'public-key',
            transports: ['internal'] as AuthenticatorTransport[],
          }],
          userVerification: 'required',
          timeout: 60000,
        },
      })

      if (credential) {
        set({ isLocked: false, isAuthenticating: false })
        return true
      }
      set({ isAuthenticating: false })
      return false
    } catch {
      set({ isAuthenticating: false })
      return false
    }
  },

  registerCredential: async () => {
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Moonwave Memo', id: window.location.hostname },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'memo-user',
            displayName: 'Memo User',
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      })

      if (credential) {
        const rawId = (credential as PublicKeyCredential).rawId
        if (!rawId) return false
        const credId = bufferToBase64(rawId)
        useSettingsStore.getState().updateAppLock({
          enabled: true, timeoutMinutes: 5, credentialId: credId,
        })
        return true
      }
      return false
    } catch {
      return false
    }
  },
}))
