/**
 * Security policy for the desktop shell — the pure, Electron-free parts, so vitest can
 * import them directly (electron/__tests__/security.test.ts). main.ts wires these into
 * the IPC handlers, the window-open handler and the navigation guards.
 *
 * Threat model: the renderer is the LIVE site (https://memo.moonwave.kr). Anything that
 * runs in that origin — an XSS, a compromised deploy, a malicious dependency — must not
 * be able to reach files outside the folders the user explicitly chose, and no other
 * origin (auth popups, iframes, a navigated-away page) may reach the file bridge at all.
 */
import * as nodePath from 'node:path'
import fsCallback, { promises as fs } from 'node:fs'
import { promisify } from 'node:util'

type PathApi = typeof nodePath.posix

// ─── Origins ─────────────────────────────────────────

/** The only origin the packaged app ever talks to over IPC. */
export const APP_ORIGIN = 'https://memo.moonwave.kr'
/** Vite dev server (vite.config.ts `server.port`); trusted only in an unpackaged build. */
export const DEV_ORIGIN = 'http://localhost:3000'

/** Google sign-in popup: the Firebase auth handler (authDomain) and Google's account pages. */
export const FIREBASE_AUTH_ORIGIN = 'https://moonwave-memo-v1.firebaseapp.com'
export const FIREBASE_AUTH_PATH_PREFIX = '/__/auth/'
export const GOOGLE_ACCOUNTS_ORIGIN = 'https://accounts.google.com'

/** Origins allowed to host the app (and call the bridge). Dev origin only when unpackaged. */
export function appOrigins(isPackaged: boolean): readonly string[] {
  return isPackaged ? [APP_ORIGIN] : [APP_ORIGIN, DEV_ORIGIN]
}

function parseUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isHttpUrl(u: URL): boolean {
  return u.protocol === 'https:' || u.protocol === 'http:'
}

// ─── IPC sender check ────────────────────────────────

export interface IpcSenderInfo {
  /** webContents id of the IPC event's sender. */
  senderId: number
  /** webContents id of the app's main window, or null if there is none. */
  mainWindowId: number | null
  /** event.senderFrame is present, attached, and the top-level frame of its webContents. */
  frameIsMain: boolean
  /** Serialized origin of event.senderFrame (`frame.origin`). */
  frameOrigin: string | null | undefined
}

/**
 * True only for the main frame of the main window, currently showing an allowed app
 * origin. Popups, iframes (e.g. the Firebase auth iframe) and any page the window was
 * somehow navigated to are all rejected.
 */
export function isTrustedIpcSender(info: IpcSenderInfo, allowedOrigins: readonly string[]): boolean {
  if (info.mainWindowId == null || info.senderId !== info.mainWindowId) return false
  if (!info.frameIsMain) return false
  return typeof info.frameOrigin === 'string' && allowedOrigins.includes(info.frameOrigin)
}

// ─── window.open / navigation ────────────────────────

export type WindowOpenDecision =
  | { action: 'auth-popup' }
  | { action: 'external'; url: string }
  | { action: 'deny' }

/** The exact popup URLs Google sign-in (Firebase signInWithPopup) needs. */
export function isAuthPopupUrl(raw: string): boolean {
  const u = parseUrl(raw)
  if (!u || u.protocol !== 'https:' || u.username || u.password) return false
  if (u.origin === FIREBASE_AUTH_ORIGIN) return u.pathname.startsWith(FIREBASE_AUTH_PATH_PREFIX)
  return u.origin === GOOGLE_ACCOUNTS_ORIGIN
}

/**
 * window.open policy for the main window: only the sign-in popup opens in-app (without
 * the preload — see main.ts); any other http(s) link goes to the system browser;
 * everything else (file:, javascript:, custom schemes…) is refused.
 */
export function decideWindowOpen(raw: string): WindowOpenDecision {
  if (isAuthPopupUrl(raw)) return { action: 'auth-popup' }
  const u = parseUrl(raw)
  if (u && isHttpUrl(u)) return { action: 'external', url: u.href }
  return { action: 'deny' }
}

export type NavigationDecision =
  | { action: 'allow' }
  | { action: 'external'; url: string }
  | { action: 'deny' }

/**
 * will-navigate / will-redirect policy for the main window: stay on the app origin;
 * external http(s) opens in the system browser; anything else is blocked.
 */
export function decideNavigation(raw: string, allowedOrigins: readonly string[]): NavigationDecision {
  const u = parseUrl(raw)
  if (!u) return { action: 'deny' }
  if (allowedOrigins.includes(u.origin)) return { action: 'allow' }
  if (isHttpUrl(u)) return { action: 'external', url: u.href }
  return { action: 'deny' }
}

// ─── Paths ───────────────────────────────────────────

/** Error surfaced to the renderer; `message` is user-facing Korean text. */
export class SyncFolderAccessError extends Error {
  readonly code: 'INVALID' | 'ESCAPE' | 'NOT_ALLOWED' | 'MISSING'
  constructor(code: SyncFolderAccessError['code'], message: string) {
    super(message)
    this.name = 'SyncFolderAccessError'
    this.code = code
  }
}

const MAX_PATH_INPUT = 4096

/** `child` is `parent` itself or somewhere below it (lexical check on normalized paths). */
export function isSameOrInside(parent: string, child: string, p: PathApi = nodePath): boolean {
  const rel = p.relative(parent, child)
  if (rel === '') return true
  if (p.isAbsolute(rel)) return false // different drive / UNC share on Windows
  return rel !== '..' && !rel.startsWith(`..${p.sep}`)
}

/** Path equality for realpaths — Windows paths are case-insensitive. */
export function samePath(a: string, b: string, p: PathApi = nodePath): boolean {
  const na = p.resolve(a)
  const nb = p.resolve(b)
  return p.sep === '\\' ? na.toLowerCase() === nb.toLowerCase() : na === nb
}

/** Validate a root path coming from the renderer (shape only; authorization is separate). */
export function validateRootInput(root: unknown, p: PathApi = nodePath): string {
  if (typeof root !== 'string' || root.length === 0 || root.length > MAX_PATH_INPUT || root.includes('\0')) {
    throw new SyncFolderAccessError('INVALID', '동기화 폴더 경로가 올바르지 않습니다.')
  }
  if (!p.isAbsolute(root)) {
    throw new SyncFolderAccessError('INVALID', '동기화 폴더 경로가 올바르지 않습니다.')
  }
  return p.resolve(root)
}

/**
 * Resolve `relPath` under `root`, refusing anything that escapes the root folder or
 * names the root itself. Lexical only — pair with assertRealPathInside for symlinks.
 */
export function resolveWithin(root: string, relPath: unknown, p: PathApi = nodePath): string {
  if (typeof relPath !== 'string' || relPath.length === 0 || relPath.length > MAX_PATH_INPUT || relPath.includes('\0')) {
    throw new SyncFolderAccessError('INVALID', '파일 경로가 올바르지 않습니다.')
  }
  // Windows: a colon means a drive-relative path ("C:foo") or an NTFS alternate data
  // stream ("memo.md:x"); sanitized memo file names never contain one.
  if (p.sep === '\\' && relPath.includes(':')) {
    throw new SyncFolderAccessError('ESCAPE', `경로가 루트를 벗어납니다: ${relPath}`)
  }
  const target = p.resolve(root, relPath)
  const rel = p.relative(root, target)
  if (rel === '' || !isSameOrInside(root, target, p)) {
    throw new SyncFolderAccessError('ESCAPE', `경로가 루트를 벗어납니다: ${relPath}`)
  }
  return target
}

function errCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException | null)?.code
}

const jsRealpath = promisify(fsCallback.realpath)

/**
 * realpath that also works on the Windows drives where the native call fails (virtual
 * or cloud drives such as Google Drive's G:\ answer EISDIR/UNKNOWN): falls back to
 * Node's JS implementation, which walks the path with lstat/readlink.
 */
export async function realpathSafe(p: string): Promise<string> {
  try {
    return await fs.realpath(p)
  } catch (err) {
    const code = errCode(err)
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP') throw err
    return jsRealpath(p)
  }
}

/**
 * Symlink-escape guard. Resolves the deepest existing ancestor of `target` (the target
 * itself when it exists) with realpath and requires it to still be inside `realRoot`
 * — so a symlink/junction inside the sync folder can't redirect a write, delete, read or
 * mkdir to somewhere else. Also refuses anything inside a `forbidden` real path (the
 * app's own userData, where the root allowlist lives).
 */
export async function assertRealPathInside(
  realRoot: string,
  target: string,
  forbidden: readonly string[] = [],
): Promise<void> {
  let probe = target
  for (;;) {
    let real: string
    try {
      real = await realpathSafe(probe)
    } catch (err) {
      const code = errCode(err)
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        const parent = nodePath.dirname(probe)
        if (parent === probe) throw err
        probe = parent
        continue
      }
      throw err
    }
    if (!isSameOrInside(realRoot, real)) {
      throw new SyncFolderAccessError('ESCAPE', '동기화 폴더 밖을 가리키는 링크는 사용할 수 없습니다.')
    }
    if (forbidden.some((f) => isSameOrInside(f, real))) {
      throw new SyncFolderAccessError('ESCAPE', '앱 데이터 폴더에는 쓸 수 없습니다.')
    }
    return
  }
}

/** Only surface user .md files from the watcher; skip the assets/ image dir and dotfiles/.trash. */
export function shouldWatchRelPath(rel: string): boolean {
  if (!rel.toLowerCase().endsWith('.md')) return false
  const parts = rel.split('/')
  return !parts.some((part) => part === 'assets' || part.startsWith('.'))
}

/**
 * A root saved by a pre-allowlist version may be re-authorized with one native confirm
 * (see rootStore.ts). Refuse the obviously wrong ones outright: hidden directories
 * (~/.ssh, ~/.config …) and anything overlapping the app's own data folder.
 */
export function isLegacyRootCandidate(realRoot: string, forbidden: readonly string[], p: PathApi = nodePath): boolean {
  const parts = realRoot.split(p.sep).filter(Boolean)
  if (parts.some((part) => part.startsWith('.'))) return false
  return !forbidden.some((f) => isSameOrInside(f, realRoot, p) || isSameOrInside(realRoot, f, p))
}
