/* Moonwave UX — 서비스 간 열기의 주소 만들기 (React 없이). 화면 부품은 OpenIn.tsx예요.
   주소는 받는 서비스의 Admin 기록(opens)에 있고 open-in-table.ts로 옮겨 와요. 화면도 서버도 다른 서비스의 주소를 직접 쓰지 않아요.
   규격: https://ux.moonwave.kr/patterns/open-in */
import { OPENS } from './open-in-table'

type Table = typeof OPENS
/** 열 수 있는 서비스예요(Admin 기록에 도메인이 있는 시스템). */
export type OpenService = keyof Table
type Routes<S extends OpenService> = Table[S]['opens']
/** 그 서비스의 열기 주소 이름이에요. `home`(첫 화면)은 모든 서비스에 있어요. */
export type OpenRoute<S extends OpenService> = 'home' | Extract<keyof Routes<S>, string>
export type OpenValue = string | number
type Need<S extends OpenService, R> = R extends keyof Routes<S> ? Routes<S>[R] extends { need: infer N } ? N : object : object
type May<S extends OpenService, R> = R extends keyof Routes<S> ? Routes<S>[R] extends { may: infer M } ? M : object : object
/** 주소에 들어갈 값이에요. 반드시 넣을 값(need)과 넣어도 되는 값(may: 빈 값이면 빠져요)이에요. */
export type OpenParams<S extends OpenService, R> = { [K in keyof Need<S, R>]: OpenValue } & { [K in keyof May<S, R>]?: OpenValue | null }
type ParamArg<S extends OpenService, R> = keyof Need<S, R> extends never ? [params?: OpenParams<S, R>] : [params: OpenParams<S, R>]

/** 갈 곳 하나예요: 어느 서비스의 어느 화면을 어떤 값으로 여는지. `label`은 표의 이름 대신 쓸 때만 줘요(서비스 이름은 늘 붙어요). */
export type OpenTarget = {
  [S in OpenService]: {
    [R in OpenRoute<S>]: { to: S; route: R; label?: string } & (keyof Need<S, R> extends never ? { params?: OpenParams<S, R> } : { params: OpenParams<S, R> })
  }[OpenRoute<S>]
}[OpenService]

type Shape = 'id' | 'number' | 'date' | 'month' | 'text' | 'path'
const SHAPE: Record<Shape, RegExp> = {
  id: /^[A-Za-z0-9][\w.:@-]{0,199}$/,
  number: /^-?\d{1,15}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  month: /^\d{4}-\d{2}$/,
  text: /^[\s\S]{1,2000}$/,
  path: /^[^?#]{1,1000}$/,
}
// ':'과 '@'는 주소 안에서 그대로 둬요(Photo가 여는 Trip 캠핑장 id `camfit:a`). 나머지는 모두 인코딩해요.
const put = (v: OpenValue) => encodeURIComponent(String(v)).replace(/%3A/gi, ':').replace(/%40/gi, '@')

type Route = { path: string; label: string; need: Record<string, string>; may: Record<string, string> }
type Service = { short: string; host: string; on: boolean; opens: Record<string, Route> }
const HOME: Route = { path: '/', label: '열기', need: {}, may: {} }

function find(to: string, route: string): { s: Service; r: Route } | null {
  const s = (OPENS as unknown as Record<string, Service>)[to]
  const r = s && (route === 'home' ? HOME : s.opens[route])
  return s && r ? { s, r } : null
}

function build(to: string, route: string, params: Record<string, OpenValue | null | undefined>): string | null {
  const hit = find(to, route)
  if (!hit || !hit.s.on) return null
  const { s, r } = hit
  const fits = (shape: string, v: OpenValue | null | undefined) => v != null && v !== '' && SHAPE[shape as Shape].test(String(v))
  if (!Object.entries(r.need).every(([name, shape]) => fits(shape, params[name]))) return null
  const given = Object.entries(r.may).filter(([name]) => params[name] != null && params[name] !== '')
  if (!given.every(([name, shape]) => fits(shape, params[name]))) return null
  const query = given.map(([name]) => `${name}=${put(params[name] as OpenValue)}`).join('&')
  const path = r.path
    .replace(/\{([?&])[^}]*\}$/, (_, lead: string) => (query ? `${lead}${query}` : ''))
    // a folder path (Photo's album) keeps the '/' between its parts; each part is encoded
    .replace(/\{([a-z][a-z0-9_]*)\}/g, (_, name: string) => (r.need[name] === 'path' ? String(params[name]).split('/').map(put).join('/') : put(params[name] as OpenValue)))
  return `https://${s.host}${path}`
}

/**
 * 다른 Moonwave 서비스의 화면 주소를 만들어요: `openIn('drive', 'file', { id })` → `https://drive.moonwave.kr/#/file/<id>`.
 * 그 서비스가 기록상 쉬고 있거나(running이 아님) 값의 모양이 맞지 않으면 `null`이에요. 그때는 그 링크나 줄을 그리지 않아요.
 * 없는 주소 이름, 빠진 값은 타입 검사가 막아요.
 */
export function openIn<S extends OpenService, R extends OpenRoute<S>>(to: S, route: R, ...args: ParamArg<S, R>): string | null {
  return build(to, route, (args[0] ?? {}) as Record<string, OpenValue | null | undefined>)
}

/** OpenTarget 하나의 주소예요. 열 수 없으면 `null`이에요. */
export function openHref(t: OpenTarget): string | null {
  return build(t.to, t.route, (t.params ?? {}) as Record<string, OpenValue | null | undefined>)
}

/** 링크와 메뉴 줄의 이름이에요: `Drive에서 파일 열기`, `Trip 열기`. 서비스 이름이 늘 들어가요. */
export function openLabel(t: OpenTarget): string {
  const hit = find(t.to, t.route)
  const short = hit?.s.short ?? t.to
  if (t.label) return t.label.includes(short) ? t.label : `${short}에서 ${t.label}`
  return t.route === 'home' ? `${short} 열기` : `${short}에서 ${hit?.r.label ?? '열기'}`
}

/** 그 주소가 다른 Moonwave 서비스의 것인지예요(없으면 `null`). 받은 링크를 앱 안에서 열지 넘길지 정할 때 써요. */
export function openServiceOf(href: string): OpenService | null {
  let host = ''
  try { host = new URL(href).host } catch { return null }
  const hit = Object.entries(OPENS as unknown as Record<string, Service>).find(([, s]) => s.host === host)
  return hit ? (hit[0] as OpenService) : null
}
