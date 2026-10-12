import { describe, it, expect, beforeEach, vi } from 'vitest'

// After an account switch the previous owner's profile must not be pushed into the new
// account (which has no cloud settings yet), while device taste (font size) stays.

const { remote, pushed } = vi.hoisted(() => ({
  remote: new Map<string, Record<string, unknown>>(),
  pushed: [] as Array<{ path: string; data: Record<string, unknown> }>,
}))

vi.mock('@/lib/firebase', () => ({ firestore: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_f: unknown, path: string, id: string) => ({ __path: `${path}/${id}` }),
  getDoc: async (ref: { __path: string }) => ({
    exists: () => remote.has(ref.__path),
    data: () => remote.get(ref.__path),
  }),
  setDoc: async (ref: { __path: string }, data: Record<string, unknown>) => {
    pushed.push({ path: ref.__path, data })
  },
  onSnapshot: () => () => {},
}))

import { useSettingsStore } from '@/stores/settingsStore'
import { initSettingsSync, stopSettingsSync } from '@/services/settingsSync'

function setLocal(name: string, defaultFolderId: number | null, fontSize: 'md' | 'lg') {
  useSettingsStore.setState((s) => ({
    settings: {
      ...s.settings,
      fontSize,
      userProfile: { ...s.settings.userProfile, name },
      memoSettings: { ...s.settings.memoSettings, defaultFolderId },
    },
  }))
}

describe('settingsSync across accounts', () => {
  beforeEach(() => {
    remote.clear()
    pushed.length = 0
    stopSettingsSync()
  })

  it('does not push the previous account profile into a new account', async () => {
    setLocal('이전 계정', 7, 'lg')
    await initSettingsSync('new-uid', { accountSwitched: true })

    const push = pushed.find((p) => p.path.startsWith('users/new-uid'))
    expect(push).toBeTruthy()
    const profile = push!.data.userProfile as { name: string }
    expect(profile.name).not.toBe('이전 계정')
    expect((push!.data.memoSettings as { defaultFolderId: unknown }).defaultFolderId).toBeNull()
    // 테마는 설정에 없어요: 키트의 테마 엔진이 기기마다 기억해요(localStorage의 memo-theme). 올리지 않아요
    expect(push!.data.theme).toBeUndefined()
    // 글자 크기 같은 보는 방식은 계정을 바꿔도 이 기기의 값이 남아요
    expect(useSettingsStore.getState().settings.fontSize).toBe('lg')
    expect(useSettingsStore.getState().settings.userProfile.name).not.toBe('이전 계정')
  })

  it('keeps local settings on a normal (same account) sign-in', async () => {
    setLocal('나', 3, 'md')
    await initSettingsSync('same-uid')

    const push = pushed.find((p) => p.path.startsWith('users/same-uid'))
    expect((push!.data.userProfile as { name: string }).name).toBe('나')
    expect(useSettingsStore.getState().settings.memoSettings.defaultFolderId).toBe(3)
  })
})
