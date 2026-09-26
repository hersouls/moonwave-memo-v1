// Test helpers: a local RSA key pair standing in for Google's securetoken keys, and a
// minter for Firebase-shaped ID tokens. (api/__tests__ is excluded from the Vercel deploy
// by .vercelignore, so nothing here becomes a function.)
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey, type JSONWebKeySet, type JWTPayload } from 'jose'

export const PROJECT_ID = 'moonwave-memo-v1'
export const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`
export const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

export interface TestKeys {
  kid: string
  privateKey: CryptoKey
  jwks: JSONWebKeySet
  getKey: ReturnType<typeof createLocalJWKSet>
}

export async function makeKeys(kid = 'test-kid'): Promise<TestKeys> {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' }
  const jwks = { keys: [jwk] }
  return { kid, privateKey, jwks, getKey: createLocalJWKSet(jwks) }
}

/** Claims set to `undefined` in `overrides` are removed from the token. */
export async function mintToken(
  keys: Pick<TestKeys, 'kid' | 'privateKey'>,
  overrides: Record<string, unknown> = {},
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const claims: Record<string, unknown> = {
    iss: ISSUER,
    aud: PROJECT_ID,
    sub: 'user-1',
    user_id: 'user-1',
    email: 'user@example.com',
    iat: nowSec,
    exp: nowSec + 3600,
    auth_time: nowSec - 60,
    firebase: { sign_in_provider: 'google.com', identities: {} },
    ...overrides,
  }
  for (const [k, v] of Object.entries(claims)) if (v === undefined) delete claims[k]
  return new SignJWT(claims as JWTPayload)
    .setProtectedHeader({ alg: 'RS256', kid: keys.kid, typ: 'JWT' })
    .sign(keys.privateKey)
}
