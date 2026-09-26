import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'

/**
 * Firebase ID-token verification for the paid AI routes, with NO service account.
 *
 * Firebase ID tokens are RS256 JWTs signed by Google's `securetoken` service. The public
 * keys are published as a JWKS, so verifying needs no credentials: check the signature
 * against that key set, then the claims Firebase documents (iss/aud = this project,
 * non-empty sub, exp/iat/auth_time sane). Revocation is NOT checked (that needs the
 * Admin SDK); a stolen token stays usable until it expires (≤ 1 h).
 */

export const FIREBASE_PROJECT_ID = 'moonwave-memo-v1'
export const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

/** Seconds of clock skew tolerated between Google's token clock and this instance. */
const CLOCK_TOLERANCE_SEC = 60
/** Real Firebase ID tokens are ~1 KB; anything far larger is garbage — reject before parsing. */
const MAX_TOKEN_CHARS = 4096
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

// Module scope = one key set per warm instance. jose caches the keys (10 min), dedupes
// concurrent fetches, and refetches on an unknown `kid` at most once per 30 s cooldown.
const firebaseJwks: JWTVerifyGetKey = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))

export interface VerifiedUser {
  uid: string
  email?: string
  signInProvider?: string
}

/** unauthorized → 401, forbidden → 403, auth_unavailable (Google keys unreachable) → 503. */
export type AuthFailure = 'unauthorized' | 'forbidden' | 'auth_unavailable'

export class AuthError extends Error {
  constructor(readonly reason: AuthFailure) {
    super(reason)
    this.name = 'AuthError'
  }
}

export interface VerifyOptions {
  /** Key source override (tests inject a local JWKS). Defaults to Google's remote JWKS. */
  getKey?: JWTVerifyGetKey
  /** Clock override for tests. */
  currentDate?: Date
}

// A failure to OBTAIN the keys (timeout, non-200, bad JSON, network) is our problem, not a
// bad token — surface it as 503 so the client doesn't treat it as "signed out".
function isKeySourceFailure(err: unknown): boolean {
  if (err instanceof errors.JWKSTimeout || err instanceof errors.JWKSInvalid) return true
  if (err instanceof errors.JOSEError) return err.code === 'ERR_JOSE_GENERIC'
  return true
}

/** Verify a Firebase ID token and return its user. Throws AuthError on any failure. */
export async function verifyFirebaseIdToken(token: string, options: VerifyOptions = {}): Promise<VerifiedUser> {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_CHARS || !JWT_SHAPE.test(token)) {
    throw new AuthError('unauthorized')
  }

  let payload: JWTPayload
  try {
    const verified = await jwtVerify(token, options.getKey ?? firebaseJwks, {
      algorithms: ['RS256'],
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
      clockTolerance: CLOCK_TOLERANCE_SEC,
      // Firebase ID tokens live 1 h; this also requires iat and rejects a future iat.
      maxTokenAge: '1h',
      requiredClaims: ['sub', 'exp', 'iat', 'auth_time'],
      currentDate: options.currentDate,
    })
    payload = verified.payload
  } catch (err) {
    if (isKeySourceFailure(err)) {
      console.error('[auth] Firebase signing keys unavailable:', err instanceof Error ? err.name : 'unknown')
      throw new AuthError('auth_unavailable')
    }
    throw new AuthError('unauthorized')
  }

  const { sub } = payload
  if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) throw new AuthError('unauthorized')

  const nowSec = Math.floor((options.currentDate?.getTime() ?? Date.now()) / 1000)
  const authTime = payload.auth_time
  if (typeof authTime !== 'number' || authTime > nowSec + CLOCK_TOLERANCE_SEC) throw new AuthError('unauthorized')

  const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined
  const signInProvider = typeof firebase?.sign_in_provider === 'string' ? firebase.sign_in_provider : undefined
  // The app only offers Google sign-in; an anonymous session is a verified token but not
  // a person we let spend the server's AI keys.
  if (signInProvider === 'anonymous') throw new AuthError('forbidden')

  return {
    uid: sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    signInProvider,
  }
}

/** `Authorization: Bearer <token>` → token, or null when absent/malformed. */
export function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string') return null
  const match = /^Bearer +(\S+) *$/i.exec(header)
  return match ? match[1] : null
}

/**
 * Optional allowlist from env AI_ALLOWED_UIDS (comma-separated Firebase uids).
 * Unset/blank → null = any verified user may pass.
 */
export function allowedUids(raw: string | undefined = process.env.AI_ALLOWED_UIDS): ReadonlySet<string> | null {
  const uids = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return uids.length > 0 ? new Set(uids) : null
}

const STATUS: Record<AuthFailure, number> = { unauthorized: 401, forbidden: 403, auth_unavailable: 503 }

/**
 * Authenticate the request (Bearer Firebase ID token + optional uid allowlist).
 * On failure writes the 401/403/503 JSON response — `{ error: <reason> }`, never any
 * detail about why — and returns null; the caller must then return immediately.
 */
export async function authenticate(
  req: VercelRequest,
  res: VercelResponse,
  options: VerifyOptions = {},
): Promise<VerifiedUser | null> {
  try {
    const token = bearerToken(req)
    if (!token) throw new AuthError('unauthorized')
    const user = await verifyFirebaseIdToken(token, options)
    const allow = allowedUids()
    if (allow && !allow.has(user.uid)) throw new AuthError('forbidden')
    return user
  } catch (err) {
    const reason: AuthFailure = err instanceof AuthError ? err.reason : 'unauthorized'
    if (reason === 'unauthorized') res.setHeader('WWW-Authenticate', 'Bearer')
    res.status(STATUS[reason]).json({ error: reason })
    return null
  }
}
