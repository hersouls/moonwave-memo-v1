import { openIn } from '@/mw/open-in'

/**
 * Memo와 Drive가 글을 주고받는 봉투.
 *
 * 글은 주소의 # 뒤에 압축해서 담아요. 그 부분은 서버로 전송되지 않아서 글이 기기 안에서만 넘어가요.
 * Drive는 Tailscale 기기에서만 열리는 서비스라 Memo 서버가 직접 닿지 않고, 받는 쪽 화면이 봉투를 풀어요.
 * Drive 쪽의 같은 코드: Vector_DB_Drive_v1.0/frontend/src/handoff.ts. 형식을 바꾸면 두 곳을 함께 바꿔요.
 */
export interface Handoff {
  v: 1
  title: string
  text: string
  /** 글의 날짜, `2026-10-03`. */
  date?: string
  /** 길어서 뒷부분을 뺐을 때. */
  cut?: boolean
}

/**
 * Drive가 봉투를 받는 주소(키트의 열기 표). 받은 메모는 Drive에서 사람이 저장을 눌러야 파일이 돼요.
 * 표의 값 모양은 2000자까지라 긴 봉투는 openIn()에 그대로 못 넘겨요. 표가 만든 주소에서 봉투 자리만 비워 이어 붙여요.
 * Drive가 쉬고 있으면 null이에요.
 */
export function driveReceiveUrl(packed: string): string | null {
  const stub = 'x'
  const base = openIn('drive', 'receive', { packed: stub })
  return base?.endsWith(stub) ? base.slice(0, -stub.length) + packed : null
}
/** Drive가 보낸 봉투가 실려 오는 # 뒤의 이름: `/share-target#drive=…`. */
const FROM_DRIVE = '#drive='
// 폰에서 다른 앱으로 넘길 수 있는 주소 길이 안쪽이에요.
const MAX_PACKED = 400_000
// 봉투를 풀었을 때 받아들이는 크기(바이트). 작게 접힌 큰 덩어리를 막아요.
const MAX_OPENED = 2_000_000

function toBase64Url(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function through(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
  limit: number,
): Promise<Uint8Array> {
  const reader = new Blob([bytes]).stream().pipeThrough(transform).getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error('too large')
    }
    parts.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

async function pack(value: Handoff): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return toBase64Url(await through(bytes, new CompressionStream('deflate-raw'), MAX_OPENED))
}

/** 봉투를 싸요. 주소에 다 들어가지 않으면 글의 뒷부분을 빼고 `cut`으로 알려요. */
export async function seal(note: Omit<Handoff, 'v' | 'cut'>): Promise<{ packed: string; cut: boolean }> {
  let text = note.text
  for (;;) {
    const cut = text.length < note.text.length
    const packed = await pack({ ...note, v: 1, text, ...(cut ? { cut } : {}) })
    if (packed.length <= MAX_PACKED || !text) return { packed, cut }
    text = text.slice(0, Math.floor(text.length / 2))
  }
}

/** 봉투를 풀어요. 모양이 맞지 않으면 던져요. */
export async function open(packed: string): Promise<Handoff> {
  if (!packed || packed.length > MAX_PACKED) throw new Error('bad handoff')
  const bytes = await through(fromBase64Url(packed), new DecompressionStream('deflate-raw'), MAX_OPENED)
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (typeof value !== 'object' || value === null) throw new Error('bad handoff')
  const { v, title, text, date, cut } = value as Record<string, unknown>
  if (v !== 1 || typeof title !== 'string' || typeof text !== 'string') throw new Error('bad handoff')
  return {
    v: 1,
    title: title.slice(0, 200),
    text,
    ...(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
    ...(cut === true ? { cut } : {}),
  }
}

/** 주소의 # 뒤에 Drive가 보낸 봉투가 있으면 그 봉투를, 없으면 null을 돌려줘요. */
export function packedFromDrive(hash: string): string | null {
  return hash.startsWith(FROM_DRIVE) ? hash.slice(FROM_DRIVE.length) : null
}

/**
 * 설치한 PWA가 열려 있는 채로 링크나 공유로 다시 불렸을 때, 앱 안에서 가야 할 주소를 돌려줘요.
 * manifest의 `launch_handler: focus-existing` 때문에 그때는 창이 앞으로 오기만 하고 주소가 바뀌지 않아요.
 * 받는 화면(`/share-target`)으로 온 것만 따라가요. 아이콘을 다시 누른 것(`/`)은 보던 화면을 그대로 둬요.
 */
export function incomingRoute(targetURL: string | undefined, origin: string): string | null {
  if (!targetURL) return null
  let url: URL
  try {
    url = new URL(targetURL)
  } catch {
    return null
  }
  return url.origin === origin && url.pathname === '/share-target' ? url.pathname + url.search + url.hash : null
}

/**
 * 글이 `# 제목` 줄로 시작하고 그 제목이 메모의 제목과 같으면 그 줄을 뺀 글을 돌려줘요.
 * Memo는 제목을 따로 두고 Drive의 마크다운 파일은 첫 줄에 두기 때문에, 오갈 때 제목이 두 번 쌓이지 않게 해요.
 */
export function withoutTitleHeading(text: string, title: string): string {
  const first = /^#\s+(.*)\r?\n?/.exec(text)
  return first && title.trim() && first[1].trim() === title.trim() ? text.slice(first[0].length).replace(/^(\r?\n)+/, '') : text
}

/** ISO 시각을 그 기기의 날짜 `2026-10-03`으로. */
export function localDay(iso: string | undefined): string {
  const at = iso ? new Date(iso) : new Date()
  const day = Number.isNaN(at.getTime()) ? new Date() : at
  const two = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`
}
