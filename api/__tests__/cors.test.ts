import { describe, expect, it } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { fakeRes } from './harness.js'

function run(method: string, origin?: unknown) {
  const req = { method, headers: origin === undefined ? {} : { origin } } as unknown as VercelRequest
  const res = fakeRes()
  const handled = applyCors(req, res as unknown as VercelResponse)
  return { res, handled }
}

describe('applyCors', () => {
  it('allows the packaged app origins with the exact listed value', () => {
    for (const origin of ['https://localhost', 'capacitor://localhost']) {
      const { res, handled } = run('POST', origin)
      expect(handled).toBe(false)
      expect(res.headers['access-control-allow-origin']).toBe(origin)
      expect(res.headers['vary']).toBe('Origin')
      expect(res.headers['access-control-allow-headers']).toBe('Content-Type, Authorization')
    }
  })

  it('sends no CORS headers to any other origin', () => {
    const others = [
      'https://evil.example',
      'https://localhost.evil.example',
      'https://localhost:8080',
      'http://localhost',
      'HTTPS://LOCALHOST',
      'https://localhost\r\nX-Injected: 1',
      'null',
      '',
      ['https://localhost'],
    ]
    for (const origin of others) {
      const { res, handled } = run('POST', origin)
      expect(handled).toBe(false)
      expect(res.headers).toEqual({})
    }
    expect(run('GET').res.headers).toEqual({})
  })

  it('answers a preflight with 204, with or without an allowed origin', () => {
    const allowed = run('OPTIONS', 'https://localhost')
    expect(allowed.handled).toBe(true)
    expect(allowed.res.statusCode).toBe(204)
    expect(allowed.res.headers['access-control-allow-origin']).toBe('https://localhost')
    expect(allowed.res.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS')

    const other = run('OPTIONS', 'https://evil.example')
    expect(other.handled).toBe(true)
    expect(other.res.statusCode).toBe(204)
    expect(other.res.headers).toEqual({})
  })
})
