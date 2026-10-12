/* Moonwave UX — 테마
   규격: https://ux.moonwave.kr/patterns/theme

   고를 수 있는 것은 셋이에요: 자동(해가 떠 있으면 밝게, 지면 어둡게) · 밝게 · 어둡게.
   일은 /theme-init.js(키트의 테마 엔진, window.mwTheme)가 해요. 첫 화면 전에 data-theme을 정하고, 해가 뜨고 질 때
   바꿔요. 이 파일은 화면이 그 값을 보여 주고 바꾸게 하는 React 쪽 연결이에요. */
import { useCallback, useSyncExternalStore } from 'react'

export type ThemeMode = 'auto' | 'light' | 'dark'
export const THEME_LABEL: Record<ThemeMode, string> = { auto: '자동', light: '밝게', dark: '어둡게' }

type Engine = {
  home: { name: string; lat: number; lon: number }
  key: string
  mode(): ThemeMode
  set(mode: ThemeMode): ThemeMode
  cycle(): ThemeMode
  dark(): boolean
  sun(date?: Date): { rise: Date; set: Date }
  next(): Date | null
  on(fn: (state: { mode: ThemeMode; dark: boolean }) => void): () => void
}
declare global { interface Window { mwTheme?: Engine } }

const engine = () => (typeof window === 'undefined' ? undefined : window.mwTheme)
const read = () => { const e = engine(); return e ? `${e.mode()}:${e.dark() ? 'dark' : 'light'}` : `auto:${document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'}` }
const listen = (fn: () => void) => engine()?.on(fn) ?? (() => {})
/** 17:58 — 집(인천)의 시각이에요. */
const clock = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

/** 지금 고른 것(mode)과 지금의 테마(dark), 그리고 바꾸는 두 가지 방법이에요. */
export function useTheme() {
  const [mode, tone] = useSyncExternalStore(listen, read, () => 'auto:light').split(':') as [ThemeMode, 'light' | 'dark']
  const cycle = useCallback(() => { engine()?.cycle() }, [])
  const set = useCallback((next: ThemeMode) => { engine()?.set(next) }, [])
  return { mode, dark: tone === 'dark', cycle, set }
}

/** 테마 버튼이 말하는 것: 고른 값, 자동이면 다음에 바뀌는 때까지. `자동 · 18:00에 어두워져요` */
export function themeHint(mode: ThemeMode, dark: boolean) {
  const next = mode === 'auto' ? engine()?.next() : null
  return next ? `${THEME_LABEL.auto} · ${clock(next)}에 ${dark ? '밝아져요' : '어두워져요'}` : THEME_LABEL[mode]
}

/** 오늘 집에서 해가 뜨고 지는 때예요. `{ place: '인천 서해구', rise: '06:38', set: '18:00' }` */
export function sunToday() {
  const e = engine()
  if (!e) return null
  const s = e.sun()
  return { place: e.home.name, rise: clock(s.rise), set: clock(s.set) }
}
