/**
 * AES-GCM encryption for API keys stored in localStorage.
 * Uses a device-specific key derived from a stable fingerprint.
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12

/** Derive a CryptoKey from a passphrase */
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('moonwave-tdl-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Get a stable device identifier for key derivation */
function getDeviceId(): string {
  const stored = localStorage.getItem('_device_id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('_device_id', id)
  return id
}

/** Encrypt plaintext → base64 string (iv + ciphertext) */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return ''
  const key = await deriveKey(getDeviceId())
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext),
  )
  // Combine iv + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

/** Decrypt base64 string → plaintext */
export async function decrypt(encoded: string): Promise<string> {
  if (!encoded) return ''
  try {
    const key = await deriveKey(getDeviceId())
    const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, IV_LENGTH)
    const ciphertext = combined.slice(IV_LENGTH)
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext,
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    // If decryption fails, assume plaintext (migration)
    return encoded
  }
}
