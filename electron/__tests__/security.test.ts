import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  APP_ORIGIN,
  DEV_ORIGIN,
  appOrigins,
  assertRealPathInside,
  decideNavigation,
  decideWindowOpen,
  isAuthPopupUrl,
  isLegacyRootCandidate,
  isSameOrInside,
  isTrustedIpcSender,
  realpathSafe,
  resolveWithin,
  samePath,
  shouldWatchRelPath,
  validateRootInput,
  type IpcSenderInfo,
} from '../security'

describe('appOrigins', () => {
  it('packaged app trusts only the live site', () => {
    expect(appOrigins(true)).toEqual([APP_ORIGIN])
  })
  it('unpackaged app also trusts the Vite dev server', () => {
    expect(appOrigins(false)).toEqual([APP_ORIGIN, DEV_ORIGIN])
    expect(DEV_ORIGIN).toBe('http://localhost:3000')
  })
})

describe('isTrustedIpcSender', () => {
  const ok: IpcSenderInfo = { senderId: 1, mainWindowId: 1, frameIsMain: true, frameOrigin: APP_ORIGIN }
  const packaged = appOrigins(true)

  it('accepts the main frame of the main window on the app origin', () => {
    expect(isTrustedIpcSender(ok, packaged)).toBe(true)
  })
  it('rejects other webContents (e.g. the auth popup)', () => {
    expect(isTrustedIpcSender({ ...ok, senderId: 2 }, packaged)).toBe(false)
  })
  it('rejects when there is no main window', () => {
    expect(isTrustedIpcSender({ ...ok, mainWindowId: null }, packaged)).toBe(false)
  })
  it('rejects subframes (e.g. the Firebase auth iframe)', () => {
    expect(isTrustedIpcSender({ ...ok, frameIsMain: false }, packaged)).toBe(false)
  })
  it('rejects foreign or missing origins', () => {
    expect(isTrustedIpcSender({ ...ok, frameOrigin: 'https://evil.example' }, packaged)).toBe(false)
    expect(isTrustedIpcSender({ ...ok, frameOrigin: 'https://memo.moonwave.kr.evil.example' }, packaged)).toBe(false)
    expect(isTrustedIpcSender({ ...ok, frameOrigin: 'http://memo.moonwave.kr' }, packaged)).toBe(false)
    expect(isTrustedIpcSender({ ...ok, frameOrigin: 'null' }, packaged)).toBe(false)
    expect(isTrustedIpcSender({ ...ok, frameOrigin: null }, packaged)).toBe(false)
  })
  it('trusts the dev origin only when unpackaged', () => {
    const dev = { ...ok, frameOrigin: DEV_ORIGIN }
    expect(isTrustedIpcSender(dev, appOrigins(true))).toBe(false)
    expect(isTrustedIpcSender(dev, appOrigins(false))).toBe(true)
  })
})

describe('window.open policy', () => {
  it('allows the Firebase auth handler and Google accounts in-app', () => {
    const handler =
      'https://moonwave-memo-v1.firebaseapp.com/__/auth/handler?apiKey=x&authType=signInViaPopup&providerId=google.com'
    expect(decideWindowOpen(handler)).toEqual({ action: 'auth-popup' })
    expect(decideWindowOpen('https://accounts.google.com/o/oauth2/auth?client_id=1')).toEqual({ action: 'auth-popup' })
  })

  it('does not allow other Firebase projects or non-auth paths', () => {
    expect(isAuthPopupUrl('https://evil-project.firebaseapp.com/__/auth/handler')).toBe(false)
    expect(isAuthPopupUrl('https://moonwave-memo-v1.firebaseapp.com/')).toBe(false)
    expect(isAuthPopupUrl('https://moonwave-memo-v1.firebaseapp.com/__/auth/../evil')).toBe(false)
    expect(isAuthPopupUrl('https://evil.example/__/auth/handler')).toBe(false)
    expect(isAuthPopupUrl('https://memo.moonwave.kr/__/auth/handler')).toBe(false)
  })

  it('does not allow look-alike hosts, http, or credentials', () => {
    expect(isAuthPopupUrl('https://accounts.google.com.evil.example/')).toBe(false)
    expect(isAuthPopupUrl('https://moonwave-memo-v1.firebaseapp.com.evil.example/__/auth/handler')).toBe(false)
    expect(isAuthPopupUrl('http://accounts.google.com/')).toBe(false)
    expect(isAuthPopupUrl('https://user:pw@accounts.google.com/')).toBe(false)
  })

  it('sends other http(s) links to the system browser', () => {
    expect(decideWindowOpen('https://github.com/hersouls')).toEqual({ action: 'external', url: 'https://github.com/hersouls' })
    expect(decideWindowOpen('http://example.com')).toEqual({ action: 'external', url: 'http://example.com/' })
  })

  it('refuses every other scheme and garbage', () => {
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'about:blank', 'data:text/html,x', 'smb://nas/share', 'not a url', '']) {
      expect(decideWindowOpen(url)).toEqual({ action: 'deny' })
    }
  })
})

describe('navigation policy', () => {
  const packaged = appOrigins(true)

  it('stays on the app origin', () => {
    expect(decideNavigation('https://memo.moonwave.kr/memos/1', packaged)).toEqual({ action: 'allow' })
    expect(decideNavigation('https://memo.moonwave.kr:443/', packaged)).toEqual({ action: 'allow' })
  })

  it('opens external http(s) in the browser instead of navigating', () => {
    expect(decideNavigation('https://objects.githubusercontent.com/x', packaged)).toEqual({
      action: 'external',
      url: 'https://objects.githubusercontent.com/x',
    })
    expect(decideNavigation('https://moonwave-memo-v1.firebaseapp.com/__/auth/handler', packaged).action).toBe('external')
    expect(decideNavigation('http://memo.moonwave.kr/', packaged).action).toBe('external')
  })

  it('blocks other schemes', () => {
    expect(decideNavigation('file:///C:/Windows/', packaged)).toEqual({ action: 'deny' })
    expect(decideNavigation('chrome://settings', packaged)).toEqual({ action: 'deny' })
    expect(decideNavigation('garbage', packaged)).toEqual({ action: 'deny' })
  })

  it('allows the dev server only when unpackaged', () => {
    expect(decideNavigation('http://localhost:3000/', packaged).action).toBe('external')
    expect(decideNavigation('http://localhost:3000/', appOrigins(false))).toEqual({ action: 'allow' })
  })
})

describe('path helpers (POSIX)', () => {
  const p = path.posix

  it('isSameOrInside', () => {
    expect(isSameOrInside('/a/b', '/a/b', p)).toBe(true)
    expect(isSameOrInside('/a/b', '/a/b/c/d.md', p)).toBe(true)
    expect(isSameOrInside('/a/b', '/a/bc', p)).toBe(false)
    expect(isSameOrInside('/a/b', '/a', p)).toBe(false)
    expect(isSameOrInside('/a/b', '/a/b/../c', p)).toBe(false)
    expect(isSameOrInside('/a/b', '/a/b/..foo', p)).toBe(true) // a name starting with "..", not a parent ref
  })

  it('validateRootInput accepts absolute paths only', () => {
    expect(validateRootInput('/Users/me/Memo', p)).toBe('/Users/me/Memo')
    expect(validateRootInput('/Users/me/Memo/../Memo/', p)).toBe('/Users/me/Memo')
    for (const bad of ['', 'relative/dir', './x', 42, null, undefined, {}, '/a\0b', `/${'x'.repeat(5000)}`]) {
      expect(() => validateRootInput(bad, p)).toThrow()
    }
  })

  it('resolveWithin keeps paths inside the root', () => {
    expect(resolveWithin('/r', 'memo.md', p)).toBe('/r/memo.md')
    expect(resolveWithin('/r', 'Folder/sub/memo.md', p)).toBe('/r/Folder/sub/memo.md')
    expect(resolveWithin('/r', 'a/../b.md', p)).toBe('/r/b.md')
  })

  it('resolveWithin rejects traversal, absolute paths, the root itself and junk', () => {
    for (const bad of ['../x.md', 'a/../../x.md', '/etc/passwd', '.', '', 'a/..', 'x\0.md', 7, null]) {
      expect(() => resolveWithin('/r', bad, p)).toThrow()
    }
  })

  it('shouldWatchRelPath only surfaces user .md files', () => {
    expect(shouldWatchRelPath('memo.md')).toBe(true)
    expect(shouldWatchRelPath('Folder/Memo.MD')).toBe(true)
    expect(shouldWatchRelPath('assets/x.md')).toBe(false)
    expect(shouldWatchRelPath('.trash/x.md')).toBe(false)
    expect(shouldWatchRelPath('a/.memo-tmp-abc')).toBe(false)
    expect(shouldWatchRelPath('photo.png')).toBe(false)
  })

  it('isLegacyRootCandidate refuses hidden dirs and the app data folder', () => {
    const userData = '/Users/me/Library/Application Support/Moonwave Memo'
    expect(isLegacyRootCandidate('/Users/me/Documents/Memo', [userData], p)).toBe(true)
    expect(isLegacyRootCandidate('/Volumes/NAS/memo', [userData], p)).toBe(true)
    expect(isLegacyRootCandidate('/Users/me/.ssh', [userData], p)).toBe(false)
    expect(isLegacyRootCandidate('/Users/me/.config/x', [userData], p)).toBe(false)
    expect(isLegacyRootCandidate(userData, [userData], p)).toBe(false)
    expect(isLegacyRootCandidate(`${userData}/IndexedDB`, [userData], p)).toBe(false)
    expect(isLegacyRootCandidate('/Users/me', [userData], p)).toBe(false) // contains userData
  })
})

describe('path helpers (Windows)', () => {
  const w = path.win32

  it('rejects other drives, UNC hops, drive-relative paths and alternate data streams', () => {
    const root = 'C:\\Users\\me\\Memo'
    expect(resolveWithin(root, 'Folder\\memo.md', w)).toBe('C:\\Users\\me\\Memo\\Folder\\memo.md')
    expect(resolveWithin(root, 'Folder/memo.md', w)).toBe('C:\\Users\\me\\Memo\\Folder\\memo.md')
    for (const bad of ['D:\\x.md', 'C:x.md', '\\\\server\\share\\x.md', '..\\x.md', 'memo.md:evil', '\\Windows\\x.md']) {
      expect(() => resolveWithin(root, bad, w)).toThrow()
    }
  })

  it('compares paths case-insensitively', () => {
    expect(samePath('C:\\Users\\Me\\Memo', 'c:\\users\\me\\memo', w)).toBe(true)
    expect(isSameOrInside('C:\\Users\\Me\\Memo', 'c:\\users\\me\\memo\\a.md', w)).toBe(true)
    expect(isSameOrInside('C:\\Memo', 'D:\\Memo\\a.md', w)).toBe(false)
  })

  it('validateRootInput accepts drive and UNC roots', () => {
    expect(validateRootInput('Z:\\memo', w)).toBe('Z:\\memo')
    expect(validateRootInput('\\\\nas\\share\\memo', w)).toBe('\\\\nas\\share\\memo')
    expect(() => validateRootInput('memo', w)).toThrow()
  })
})

describe('assertRealPathInside (symlink escapes)', () => {
  let base: string
  let root: string
  let outside: string

  beforeAll(async () => {
    base = await realpathSafe(await fs.mkdtemp(path.join(os.tmpdir(), 'memo-sec-')))
    root = path.join(base, 'root')
    outside = path.join(base, 'outside')
    await fs.mkdir(path.join(root, 'Folder'), { recursive: true })
    await fs.mkdir(outside, { recursive: true })
    await fs.writeFile(path.join(root, 'Folder', 'memo.md'), 'x')
    await fs.writeFile(path.join(outside, 'secret.md'), 'secret')
    await fs.symlink(outside, path.join(root, 'escape-dir'))
    await fs.symlink(path.join(outside, 'secret.md'), path.join(root, 'escape.md'))
    await fs.symlink(path.join(root, 'Folder'), path.join(root, 'inner-link'))
  })

  afterAll(async () => {
    await fs.rm(base, { recursive: true, force: true })
  })

  it('accepts existing and not-yet-existing paths inside the root', async () => {
    await expect(assertRealPathInside(root, path.join(root, 'Folder', 'memo.md'))).resolves.toBeUndefined()
    await expect(assertRealPathInside(root, path.join(root, 'New', 'deep', 'memo.md'))).resolves.toBeUndefined()
    await expect(assertRealPathInside(root, path.join(root, 'inner-link', 'x.md'))).resolves.toBeUndefined()
  })

  it('rejects a directory symlink that points outside', async () => {
    await expect(assertRealPathInside(root, path.join(root, 'escape-dir', 'new.md'))).rejects.toThrow(/링크/)
    await expect(assertRealPathInside(root, path.join(root, 'escape-dir', 'secret.md'))).rejects.toThrow(/링크/)
    await expect(assertRealPathInside(root, path.join(root, 'escape-dir', 'a', 'b', 'c.md'))).rejects.toThrow(/링크/)
  })

  it('rejects a file symlink that points outside', async () => {
    await expect(assertRealPathInside(root, path.join(root, 'escape.md'))).rejects.toThrow(/링크/)
  })

  it('rejects anything inside a forbidden folder (the app data dir)', async () => {
    await expect(assertRealPathInside(base, path.join(root, 'Folder', 'memo.md'), [root])).rejects.toThrow(/앱 데이터/)
  })
})
