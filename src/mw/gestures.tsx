/* Moonwave UX — 손짓 단계의 React 쪽 연결
   설정은 gesture-settings.ts의 저장소 하나에 있어요. 이 파일은 화면이 그 값을 읽고 바꾸고, 로그인한 서비스가 서버와 맞추게 해요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures#levels */
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import {
  connectGestureRemote, defaultGestureSettings, getGestureSettings, levelOn, DEFAULT_LEVEL, resetHints, setGestureSettings,
  subscribeGestureSettings, systemReducedMotion, withGesture, withLevel,
} from './gesture-settings'
import type { GestureId, GestureLevel, GestureRemote, GestureSettings, GestureSync } from './gesture-settings'

/** 단계와 켜짐 말고, 설정에서 바로 바꾸는 값이에요. */
export type GesturePatch = Partial<Pick<GestureSettings, 'sensitivity' | 'press' | 'haptics' | 'confirmDelete' | 'left' | 'right' | 'motion'>>

/** 지금 설정과 바꾸는 방법이에요. 바꾸면 이 화면과 같은 기기의 다른 탭에 바로 반영돼요. */
export function useGestureSettings() {
  const settings = useSyncExternalStore(subscribeGestureSettings, getGestureSettings, getGestureSettings)
  return useMemo(() => ({
    settings,
    /** 값 몇 개를 바꿔요. */
    set: (patch: GesturePatch) => setGestureSettings((s) => ({ ...s, ...patch })),
    /** 단계를 골라요. 손짓 켜짐이 그 단계의 것으로 바뀌어요. */
    setLevel: (level: GestureLevel) => setGestureSettings((s) => withLevel(s, level)),
    /** 손짓 하나를 켜거나 꺼요. 어느 단계와도 같지 않으면 단계가 ‘커스텀’이 돼요. */
    setGesture: (id: GestureId, on: boolean) => setGestureSettings((s) => withGesture(s, id, on)),
    /** 모두 처음 값(표준)으로 돌려요. */
    reset: () => setGestureSettings(defaultGestureSettings()),
    /** 처음 한 번만 보이던 손짓 안내를 다시 보여요. */
    resetHints,
  }), [settings])
}

/** 손짓 하나가 켜져 있는지예요. 꺼져 있으면 그 손짓의 이벤트를 붙이지 않을 때 써요. */
export function useGesture(id: GestureId): boolean {
  return useSyncExternalStore(subscribeGestureSettings, () => getGestureSettings().on[id], () => levelOn(DEFAULT_LEVEL)[id])
}

/** 손짓의 움직임을 줄여야 하는지예요: 설정에서 골랐거나, 기기의 움직임 줄이기가 켜져 있어요. */
export function useReducedMotion(): boolean {
  const chosen = useSyncExternalStore(subscribeGestureSettings, () => getGestureSettings().motion === 'reduce', () => false)
  const [system, setSystem] = useState(systemReducedMotion)
  useEffect(() => {
    let mq: MediaQueryList
    try { mq = matchMedia('(prefers-reduced-motion: reduce)') } catch { return }
    const on = () => setSystem(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return chosen || system
}

const SyncContext = createContext<GestureSync>('local')

export type GestureSettingsProviderProps = {
  /**
   * 로그인한 사람의 설정을 서버에 둘 때 넘겨요: 서버의 사용자 설정을 읽고 쓰는 두 함수예요.
   * 바뀔 때마다 다시 이어지지 않게 `useMemo`로 한 번 만들어 넘겨요. 없으면 이 기기에만 둬요.
   */
  remote?: GestureRemote | null
  children: ReactNode
}

/**
 * 앱 맨 바깥에 한 번 둬요. 설정 자체는 어디서나 `useGestureSettings`로 읽혀요.
 * 이것이 하는 일은 서버와 맞추는 것과, 지금 맞춰져 있는지(`useGestureSync`)를 알려 주는 것이에요.
 */
export function GestureSettingsProvider({ remote, children }: GestureSettingsProviderProps) {
  const [sync, setSync] = useState<GestureSync>(remote ? 'syncing' : 'local')
  useEffect(() => (remote ? connectGestureRemote(remote, setSync) : undefined), [remote])
  return <SyncContext.Provider value={remote ? sync : 'local'}>{children}</SyncContext.Provider>
}

/** 설정이 어디에 있는지예요: 이 기기에만(`local`), 서버와 맞추는 중(`syncing`), 맞춰짐(`synced`), 서버에 닿지 못함(`offline`). */
export function useGestureSync(): GestureSync {
  return useContext(SyncContext)
}
