/* Moonwave UX — 손짓 단계: 어떤 손짓을 쓰고, 얼마나 민감하게 받을지
   React 없이 쓰는 설정 저장소예요. 키트의 손짓(touch.ts · haptics · SwipeItem …)이 모두 여기서 켜짐과 값을 읽어요.
   이 기기의 localStorage(`mw:gestures`)에 두고, 로그인이 있는 서비스는 GestureSettingsProvider의 remote로 서버에도 둬요.
   어느 단계에서도 모든 일은 버튼과 메뉴로 할 수 있어요. 손짓은 빠른 길이에요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures#levels */

/** 키트가 아는 손짓이에요. */
export type GestureId = 'pull' | 'sheet' | 'menu' | 'swipe' | 'favorite' | 'zoom' | 'fullSwipe' | 'reorder' | 'pinchView' | 'tabSwipe' | 'peek' | 'sequenceSwipe'
/** 0 끔 · 1 기본 · 2 표준(처음 값) · 3 파워예요. */
export type GestureLevel = 0 | 1 | 2 | 3
/** 밀기에 둘 수 있는 행동이에요. */
export type SwipeAction = 'done' | 'pin' | 'archive' | 'delete' | 'share' | 'snooze' | 'move'
/** 밀기 민감도예요. 높을수록 조금만 밀어도 걸려요. */
export type SwipeSensitivity = 'low' | 'normal' | 'high'
/** 길게 누르기가 받아들여지기까지의 시간이에요. */
export type PressTime = 'short' | 'normal' | 'long'
/** 움직임: `auto`는 기기의 움직임 줄이기를 따르고, `reduce`는 기기와 상관없이 늘 줄여요. */
export type GestureMotion = 'auto' | 'reduce'

export type GestureSettings = {
  /** 저장 형식의 판이에요. */
  v: 1
  /** 고른 단계예요. 손짓을 하나씩 바꿔 어느 단계와도 같지 않으면 `custom`이에요. */
  level: GestureLevel | 'custom'
  /** 손짓마다 켜져 있는지예요. */
  on: Record<GestureId, boolean>
  sensitivity: SwipeSensitivity
  press: PressTime
  /** 진동을 쓸지예요. 진동이 없는 기기에서는 켜 두어도 아무 일이 없어요. */
  haptics: boolean
  /** 끝까지 밀어 지우기 전에 한 번 물을지예요. 묻지 않아도 5초 동안 되돌릴 수 있어요. */
  confirmDelete: boolean
  /** 왼쪽으로 밀 때 · 오른쪽으로 밀 때 먼저 놓이는 행동이에요. 끝까지 밀면 이것을 해요. */
  left: SwipeAction
  right: SwipeAction
  motion: GestureMotion
  /** 마지막으로 바꾼 때(ms)예요. 기기와 서버의 값 가운데 나중 것을 써요. 0은 바꾼 적이 없다는 뜻이에요. */
  at: number
}

export type GestureInfo = {
  id: GestureId
  /** 처음 켜지는 단계예요. */
  level: 1 | 2 | 3
  /** 설정에 보이는 이름이에요. */
  label: string
  /** 어떻게 하는지 한 줄이에요. */
  how: string
  /** 같은 일을 손짓 없이 하는 길이에요. */
  instead: string
}

/** 손짓의 목록이에요. 단계 순서대로예요. */
export const GESTURES: readonly GestureInfo[] = [
  { id: 'pull', level: 1, label: '당겨서 새로 고침', how: '목록의 맨 위에서 아래로 당겨요.', instead: '새로 고침 버튼' },
  { id: 'sheet', level: 1, label: '시트 끌기', how: '시트의 손잡이를 위아래로 끌어 높이를 바꾸고, 아래로 내려 닫아요.', instead: '손잡이 누르기 · 바깥 누르기 · 뒤로 가기' },
  { id: 'menu', level: 1, label: '길게 눌러 메뉴', how: '항목을 누른 채 기다리면 메뉴가 올라와요.', instead: '항목의 ⋯ 버튼' },
  { id: 'swipe', level: 2, label: '밀어서 행동 보기', how: '항목을 옆으로 밀면 행동 버튼이 나와요.', instead: '항목의 ⋯ 버튼' },
  { id: 'favorite', level: 2, label: '두 번 탭해 즐겨찾기', how: '카드를 빠르게 두 번 탭해요.', instead: '하트 버튼 · 메뉴' },
  { id: 'zoom', level: 2, label: '사진 확대 · 넘기기', how: '두 손가락을 벌리거나 두 번 탭해 확대하고, 옆으로 밀어 넘겨요.', instead: '크게 보기 · 이전 · 다음 버튼' },
  { id: 'fullSwipe', level: 3, label: '끝까지 밀어 바로 하기', how: '항목을 끝까지 밀었다 놓으면 그 행동을 바로 해요.', instead: '밀어서 나온 버튼 · ⋯ 메뉴' },
  { id: 'reorder', level: 3, label: '끌어서 순서 바꾸기', how: '길게 누른 채 위아래로 끌어요.', instead: '메뉴의 위로 · 아래로 옮기기' },
  { id: 'pinchView', level: 3, label: '모아서 보기 바꾸기', how: '목록 위에서 두 손가락을 모으면 그리드, 벌리면 카드로 보여요.', instead: '보기 방식 칩' },
  { id: 'tabSwipe', level: 3, label: '탭 줄 밀기', how: '아래의 탭 줄을 옆으로 밀면 옆 탭으로 가요.', instead: '탭 누르기' },
  { id: 'sequenceSwipe', level: 3, label: '상세 제목 밀어 넘기기', how: '상세 화면의 제목을 옆으로 밀면 이전·다음 항목으로 가요.', instead: '이전 · 다음 버튼' },
  { id: 'peek', level: 3, label: '길게 눌러 미리 보기', how: '길게 누르면 메뉴 위에 내용이 먼저 보여요.', instead: '항목 열기' },
]
export const GESTURE_IDS: readonly GestureId[] = GESTURES.map((g) => g.id)

export type LevelInfo = { level: GestureLevel; label: string; about: string }
export const LEVELS: readonly LevelInfo[] = [
  { level: 0, label: '끔', about: '손짓을 모두 끄고 버튼과 메뉴로만 써요.' },
  { level: 1, label: '기본', about: '당겨서 새로 고침, 시트 끌기, 길게 눌러 메뉴만 써요.' },
  { level: 2, label: '표준', about: '기본에 밀어서 행동 보기, 두 번 탭해 즐겨찾기, 사진 확대 · 넘기기를 더해요.' },
  { level: 3, label: '파워', about: '표준에 끝까지 밀어 바로 하기, 끌어서 순서 바꾸기, 모아서 보기 바꾸기, 탭 줄 밀기, 미리 보기를 더해요.' },
]
/** 처음 값이에요. */
export const DEFAULT_LEVEL: GestureLevel = 2
/** 손짓 단계를 고르는 묶음의 이름이에요. 화면 점검이 이 이름으로 설정을 찾아요. */
export const LEVEL_GROUP_LABEL = '손짓 단계'

export const SWIPE_ACTIONS: readonly SwipeAction[] = ['done', 'pin', 'archive', 'delete', 'share', 'snooze', 'move']
export const SWIPE_ACTION_LABEL: Record<SwipeAction, string> = { done: '완료', pin: '고정', archive: '보관', delete: '지우기', share: '공유', snooze: '나중에 보기', move: '폴더로 옮기기' }
export const SENSITIVITY_LABEL: Record<SwipeSensitivity, string> = { low: '낮음', normal: '보통', high: '높음' }
export const PRESS_LABEL: Record<PressTime, string> = { short: '짧게', normal: '보통', long: '길게' }

/** 밀기가 걸리는 거리(px)예요. 이만큼 밀거나, 손을 뗄 때 SWIPE_SPEED보다 빠르면 걸리고, 못 미치면 제자리로 돌아가요. */
export const SWIPE_DISTANCE: Record<SwipeSensitivity, number> = { low: 140, normal: 100, high: 70 }
/** 손을 뗄 때 이보다 빠르면(px/ms) 거리가 모자라도 걸려요. 500px/s예요. */
export const SWIPE_SPEED = 0.5
/** 길게 누르기가 받아들여지기까지의 시간(ms)이에요. */
export const PRESS_MS: Record<PressTime, number> = { short: 350, normal: 500, long: 700 }
/** 화면 양옆 이 너비(px) 안에서 시작한 손짓은 받지 않아요. 폰의 뒤로 가기 손짓이 쓰는 곳이에요. */
export const EDGE_PX = 20
/** 길게 누르는 동안 손가락이 이만큼(px) 넘게 움직이면 누르기가 아니에요. */
export const PRESS_SLOP = 8
/** 이 간격(ms) 안의 두 탭이 두 번 탭이에요. */
export const DOUBLE_TAP_MS = 280
/** 끝까지 밀었다고 보는 비율이에요. 항목 너비의 이만큼을 넘겨 놓으면 바로 해요. */
export const FULL_SWIPE = 0.6

const ALL_LEVELS: readonly GestureLevel[] = [0, 1, 2, 3]

/** 단계 하나에서 켜지는 손짓이에요. */
export function levelOn(level: GestureLevel): Record<GestureId, boolean> {
  const on = {} as Record<GestureId, boolean>
  for (const g of GESTURES) on[g.id] = g.level <= level
  return on
}

/** 손짓 켜짐이 어느 단계와 같으면 그 단계, 아니면 null이에요. */
export function matchLevel(on: Record<GestureId, boolean>): GestureLevel | null {
  for (const level of ALL_LEVELS) {
    const want = levelOn(level)
    if (GESTURE_IDS.every((id) => want[id] === on[id])) return level
  }
  return null
}

export function defaultGestureSettings(): GestureSettings {
  return { v: 1, level: DEFAULT_LEVEL, on: levelOn(DEFAULT_LEVEL), sensitivity: 'normal', press: 'normal', haptics: true, confirmDelete: false, left: 'delete', right: 'done', motion: 'auto', at: 0 }
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** 저장된 값(무엇이든)을 설정으로 읽어요. 모르는 값은 처음 값으로 채우고, 단계는 켜짐에서 다시 정해요. */
export function readGestureSettings(raw: unknown): GestureSettings {
  const d = defaultGestureSettings()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  const level = typeof r.level === 'number' && (ALL_LEVELS as readonly number[]).includes(r.level) ? (r.level as GestureLevel) : r.level === 'custom' ? 'custom' : d.level
  const onRaw = r.on && typeof r.on === 'object' ? (r.on as Record<string, unknown>) : {}
  // 단계를 골라 두었으면 그 단계의 켜짐이 답이에요. 커스텀일 때만 손짓 하나하나를 읽어요.
  const base = level === 'custom' ? d.on : levelOn(level)
  const on = {} as Record<GestureId, boolean>
  for (const id of GESTURE_IDS) {
    const v = onRaw[id]
    on[id] = level === 'custom' && typeof v === 'boolean' ? v : base[id]
  }
  return {
    v: 1,
    level: matchLevel(on) ?? 'custom',
    on,
    sensitivity: pick(r.sensitivity, ['low', 'normal', 'high'], d.sensitivity),
    press: pick(r.press, ['short', 'normal', 'long'], d.press),
    haptics: typeof r.haptics === 'boolean' ? r.haptics : d.haptics,
    confirmDelete: typeof r.confirmDelete === 'boolean' ? r.confirmDelete : d.confirmDelete,
    left: pick(r.left, SWIPE_ACTIONS, d.left),
    right: pick(r.right, SWIPE_ACTIONS, d.right),
    motion: pick(r.motion, ['auto', 'reduce'], d.motion),
    at: typeof r.at === 'number' && Number.isFinite(r.at) && r.at > 0 ? r.at : 0,
  }
}

/** 단계를 골라요. 손짓 켜짐이 그 단계의 것으로 바뀌어요. */
export function withLevel(s: GestureSettings, level: GestureLevel): GestureSettings {
  return { ...s, level, on: levelOn(level) }
}

/** 손짓 하나를 켜거나 꺼요. 어느 단계와도 같지 않게 되면 단계가 `custom`이 돼요. */
export function withGesture(s: GestureSettings, id: GestureId, on: boolean): GestureSettings {
  const next = { ...s.on, [id]: on }
  return { ...s, on: next, level: matchLevel(next) ?? 'custom' }
}

// ── 저장소: 이 기기의 localStorage, 바뀌면 듣는 쪽에 알려요(다른 탭에서 바꾼 것도)

const KEY = 'mw:gestures'
const HINT = 'mw:hint:'
let state: GestureSettings | null = null
const listeners = new Set<() => void>()
let listening = false

function load(): GestureSettings {
  try {
    const text = localStorage.getItem(KEY)
    return readGestureSettings(text ? JSON.parse(text) : null)
  } catch { return defaultGestureSettings() }
}

/** 키트의 CSS가 움직임을 줄이게 `<html data-mw-motion="reduce">`를 붙여요. */
function paint(s: GestureSettings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (s.motion === 'reduce') root.setAttribute('data-mw-motion', 'reduce')
  else root.removeAttribute('data-mw-motion')
}

/** 지금 설정이에요. 같은 값이면 같은 객체를 돌려줘요(useSyncExternalStore가 그대로 써요). */
export function getGestureSettings(): GestureSettings {
  if (!state) { state = load(); paint(state) }
  return state
}

export type SetGestureOptions = {
  /** 바꾼 때예요. 서버에서 받은 값을 그대로 둘 때 그 값의 때를 넘겨요. */
  at?: number
}

/** 설정을 바꿔요. 저장하고, 듣는 쪽에 바로 알려요. 새로 고치지 않아도 돼요. */
export function setGestureSettings(next: GestureSettings | ((now: GestureSettings) => GestureSettings), options: SetGestureOptions = {}) {
  const value = readGestureSettings(typeof next === 'function' ? next(getGestureSettings()) : next)
  value.at = options.at ?? Date.now()
  state = value
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* 저장소를 쓸 수 없어도 이 화면에서는 바로 바뀌어요 */ }
  paint(value)
  listeners.forEach((fn) => fn())
}

/** 설정이 바뀌면 불러요. 돌려주는 함수를 부르면 그만 들어요. */
export function subscribeGestureSettings(fn: () => void): () => void {
  listeners.add(fn)
  if (!listening && typeof window !== 'undefined') {
    listening = true
    window.addEventListener('storage', (event) => {
      if (event.key !== KEY) return
      state = load()
      paint(state)
      listeners.forEach((l) => l())
    })
  }
  return () => { listeners.delete(fn) }
}

/** 손짓 하나가 지금 켜져 있는지예요. */
export function gestureOn(id: GestureId): boolean {
  return getGestureSettings().on[id]
}

/** 지금의 밀기 거리(px)예요. */
export function swipeDistance(): number {
  return SWIPE_DISTANCE[getGestureSettings().sensitivity]
}

/** 지금의 길게 누르기 시간(ms)이에요. */
export function pressMs(): number {
  return PRESS_MS[getGestureSettings().press]
}

/** 기기에서 움직임 줄이기를 켜 두었는지예요. */
export function systemReducedMotion(): boolean {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** 손짓의 움직임을 줄여야 하는지예요: 설정에서 줄이기를 골랐거나, 기기가 그렇게 해 두었어요. */
export function reducedMotion(): boolean {
  return getGestureSettings().motion === 'reduce' || systemReducedMotion()
}

/**
 * 이 기기가 진동할 수 있는지예요. Android의 브라우저는 되고, iOS Safari와 데스크톱은 안 돼요.
 * 데스크톱 Chrome에도 `navigator.vibrate`는 있지만 떨 것이 없어서, 손가락으로 쓰는 기기인지도 함께 봐요.
 */
export function canVibrate(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  try { return matchMedia('(pointer: coarse)').matches } catch { return false }
}

/** 손짓 안내(처음 한 번)를 이미 보였는지예요. */
export function hintSeen(name: string): boolean {
  try { return localStorage.getItem(HINT + name) === '1' } catch { return true }
}

/** 손짓 안내를 보였다고 적어요. 다시 보이지 않아요. */
export function markHint(name: string) {
  try { localStorage.setItem(HINT + name, '1') } catch { /* 저장소를 쓸 수 없으면 다음에 한 번 더 보여요 */ }
}

/** 손짓 안내를 모두 처음으로 돌려요. 설정의 ‘안내 다시 보기’예요. */
export function resetHints() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(HINT)) keys.push(k) }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch { /* 저장소를 쓸 수 없어요 */ }
}

// ── 서버에 둘 때: 로그인한 사람의 설정을 기기끼리 맞춰요

/** 서비스가 자기 서버의 사용자 설정에 이어 주는 두 함수예요. 값은 그대로 JSON으로 두면 돼요. */
export type GestureRemote = {
  /** 서버에 둔 값을 받아요. 없으면 null이에요. */
  load: () => Promise<unknown>
  /** 지금 값을 서버에 둬요. */
  save: (value: GestureSettings) => Promise<unknown>
}
export type GestureSync = 'local' | 'syncing' | 'synced' | 'offline'

/**
 * 서버의 값과 이 기기의 값을 맞추고, 바뀔 때마다 서버에 둬요(0.4초 모아서).
 * 둘 가운데 나중에 바꾼 것을 써요. 서버에 닿지 못하면 이 기기의 값으로 계속 쓰고 `offline`을 알려요.
 */
export function connectGestureRemote(remote: GestureRemote, onSync?: (state: GestureSync) => void): () => void {
  let alive = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let applying = false
  const tell = (s: GestureSync) => { if (alive) onSync?.(s) }
  const push = () => {
    tell('syncing')
    remote.save(getGestureSettings()).then(() => tell('synced'), () => tell('offline'))
  }
  tell('syncing')
  remote.load().then((raw) => {
    if (!alive) return
    const mine = getGestureSettings()
    const theirs = raw == null ? null : readGestureSettings(raw)
    if (theirs && theirs.at > mine.at) {
      applying = true
      setGestureSettings(theirs, { at: theirs.at })
      applying = false
      tell('synced')
    } else if (mine.at > 0 && mine.at > (theirs?.at ?? 0)) push()
    else tell('synced')
  }, () => tell('offline'))
  const off = subscribeGestureSettings(() => {
    if (applying) return
    clearTimeout(timer)
    timer = setTimeout(push, 400)
  })
  return () => { alive = false; clearTimeout(timer); off() }
}
