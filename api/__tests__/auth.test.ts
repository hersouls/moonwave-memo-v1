import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { SignJWT, base64url, errors, type JWTVerifyGetKey } from 'jose'
import type { VercelRequest } from '@vercel/node'
import { AuthError, allowedUids, bearerToken, verifyFirebaseIdToken, type AuthFailure } from '../lib/auth.js'
import { GOOGLE_JWKS_URL, makeKeys, mintToken, type TestKeys } from './firebaseTokens.js'

let keys: TestKeys
let otherKeys: TestKeys

beforeAll(async () => {
  keys = await makeKeys('kid-1')
  otherKeys = await makeKeys('kid-1') // same kid, different key material
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function reason(p: Promise<unknown>): Promise<AuthFailure | 'ok'> {
  try {
    await p
    return 'ok'
  } catch (err) {
    if (err instanceof AuthError) return err.reason
    throw err
  }
}

describe('verifyFirebaseIdToken (injected local JWKS)', () => {
  const verify = (token: string, getKey: JWTVerifyGetKey = keys.getKey) => verifyFirebaseIdToken(token, { getKey })

  it('accepts a valid Firebase ID token and returns the uid', async () => {
    const user = await verify(await mintToken(keys, { sub: 'abc123' }))
    expect(user).toEqual({ uid: 'abc123', email: 'user@example.com', signInProvider: 'google.com' })
  })

  it.each([
    ['wrong audience', { aud: 'some-other-project' }],
    ['wrong issuer', { iss: 'https://securetoken.google.com/some-other-project' }],
    ['issuer of a different Google service', { iss: 'https://accounts.google.com' }],
    ['expired beyond the clock tolerance', { exp: Math.floor(Date.now() / 1000) - 120 }],
    ['iat in the future', { iat: Math.floor(Date.now() / 1000) + 600, exp: Math.floor(Date.now() / 1000) + 4200 }],
    ['older than 1 h (iat)', { iat: Math.floor(Date.now() / 1000) - 3 * 3600 }],
    ['auth_time in the future', { auth_time: Math.floor(Date.now() / 1000) + 600 }],
    ['missing auth_time', { auth_time: undefined }],
    ['missing sub', { sub: undefined }],
    ['empty sub', { sub: '' }],
    ['over-long sub', { sub: 'x'.repeat(129) }],
  ])('rejects %s → unauthorized', async (_label, overrides) => {
    expect(await reason(verify(await mintToken(keys, overrides)))).toBe('unauthorized')
  })

  it('tolerates small clock skew on exp', async () => {
    const token = await mintToken(keys, { exp: Math.floor(Date.now() / 1000) - 30 })
    expect(await reason(verify(token))).toBe('ok')
  })

  it('rejects a token signed by a different key (same kid)', async () => {
    expect(await reason(verify(await mintToken(otherKeys)))).toBe('unauthorized')
  })

  it('rejects HS256 and unsigned (alg none) tokens', async () => {
    const now = Math.floor(Date.now() / 1000)
    const claims = { iss: 'https://securetoken.google.com/moonwave-memo-v1', aud: 'moonwave-memo-v1', sub: 'u', iat: now, exp: now + 3600, auth_time: now }
    const hs = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256', kid: 'kid-1' }).sign(new TextEncoder().encode('x'.repeat(32)))
    expect(await reason(verify(hs))).toBe('unauthorized')

    const none = `${base64url.encode(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${base64url.encode(JSON.stringify(claims))}.`
    expect(await reason(verify(none))).toBe('unauthorized')
  })

  it('rejects garbage and oversized strings without touching the key source', async () => {
    const getKey = vi.fn(keys.getKey)
    for (const t of ['', 'not-a-jwt', 'a.b', 'a.b.c.d', `${'a'.repeat(5000)}.b.c`]) {
      expect(await reason(verify(t, getKey))).toBe('unauthorized')
    }
    expect(getKey).not.toHaveBeenCalled()
  })

  it('rejects anonymous sessions → forbidden', async () => {
    const token = await mintToken(keys, { firebase: { sign_in_provider: 'anonymous' } })
    expect(await reason(verify(token))).toBe('forbidden')
  })

  it('maps an unreachable key source to auth_unavailable (not unauthorized)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const token = await mintToken(keys)
    const timeout: JWTVerifyGetKey = async () => { throw new errors.JWKSTimeout() }
    const network: JWTVerifyGetKey = async () => { throw new TypeError('fetch failed') }
    expect(await reason(verify(token, timeout))).toBe('auth_unavailable')
    expect(await reason(verify(token, network))).toBe('auth_unavailable')
  })
})

describe('verifyFirebaseIdToken (default remote Google JWKS)', () => {
  it('fetches the securetoken JWKS once and verifies against it', async () => {
    vi.resetModules()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(keys.jwks), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const auth = await import('../lib/auth.js')

    await expect(auth.verifyFirebaseIdToken(await mintToken(keys, { sub: 'remote-user' }))).resolves.toMatchObject({ uid: 'remote-user' })
    await expect(auth.verifyFirebaseIdToken(await mintToken(keys))).resolves.toMatchObject({ uid: 'user-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1) // cached at module scope
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(GOOGLE_JWKS_URL)
  })

  it('fails closed with auth_unavailable when Google answers non-200', async () => {
    vi.resetModules()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })))
    const auth = await import('../lib/auth.js')
    const err = await auth.verifyFirebaseIdToken(await mintToken(keys)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(auth.AuthError)
    expect((err as InstanceType<typeof auth.AuthError>).reason).toBe('auth_unavailable')
  })
})

describe('bearerToken / allowedUids', () => {
  const req = (authorization?: string) => ({ headers: authorization === undefined ? {} : { authorization } }) as VercelRequest

  it('extracts only a well-formed Bearer credential', () => {
    expect(bearerToken(req('Bearer abc.def.ghi'))).toBe('abc.def.ghi')
    expect(bearerToken(req('bearer abc.def.ghi'))).toBe('abc.def.ghi')
    expect(bearerToken(req())).toBeNull()
    expect(bearerToken(req('Basic dXNlcjpwYXNz'))).toBeNull()
    expect(bearerToken(req('Bearer '))).toBeNull()
    expect(bearerToken(req('Bearer a b'))).toBeNull()
  })

  it('parses AI_ALLOWED_UIDS; blank means no allowlist', () => {
    expect(allowedUids(undefined)).toBeNull()
    expect(allowedUids('  ,  ')).toBeNull()
    expect([...(allowedUids(' uid-a, uid-b ,,') ?? [])]).toEqual(['uid-a', 'uid-b'])
  })
})
