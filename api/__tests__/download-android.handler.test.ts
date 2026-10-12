import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import downloadAndroid, { clearRecordMemory } from '../download-android.js'
import { fakeRes } from './harness.js'

const RELEASE = 'https://github.com/hersouls/moonwave-memo-v1/releases/download/android'
const RECORD = { versionName: '1.0.2', versionCode: 133, sha: 'e926254', builtAt: '2026-10-12T05:43:01+09:00', sizeBytes: 10878743, sha256: 'bb81', file: 'memo_v1.0.2_261012.apk' }

let upstream: () => Response
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url === `${RELEASE}/android.json`) return upstream()
  throw new Error(`unexpected fetch ${url}`)
})
const json = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 })

async function call(query: Record<string, string> = {}, method = 'GET') {
  const res = fakeRes()
  await downloadAndroid({ method, headers: {}, query } as unknown as VercelRequest, res as unknown as VercelResponse)
  return res
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  clearRecordMemory()
  upstream = json(RECORD)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api/download-android', () => {
  it('redirects to the file the record names, and no cache keeps the redirect', async () => {
    const res = await call()
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe(`${RELEASE}/memo_v1.0.2_261012.apk`)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('follows the record to the next build without a change here', async () => {
    upstream = json({ ...RECORD, versionCode: 140, builtAt: '2026-10-13T05:42:10+09:00', file: 'memo_v1.0.2_261013.apk' })
    const res = await call()
    expect(res.headers.location).toBe(`${RELEASE}/memo_v1.0.2_261013.apk`)
  })

  it('answers the record with ?info=1', async () => {
    const res = await call({ info: '1' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ versionName: '1.0.2', versionCode: 133, builtAt: '2026-10-12T05:43:01+09:00', sizeBytes: 10878743, file: 'memo_v1.0.2_261012.apk' })
  })

  it('takes the last part of a record that names the file with a path', async () => {
    upstream = json({ ...RECORD, file: '/app/memo_v1.0.2_261012.apk' })
    const res = await call()
    expect(res.headers.location).toBe(`${RELEASE}/memo_v1.0.2_261012.apk`)
  })

  it('does not redirect to anything but a file of the release', async () => {
    for (const file of ['https://example.com/x.apk?', '..', 'memo.exe', '', undefined]) {
      clearRecordMemory()
      upstream = json({ ...RECORD, file })
      const res = await call()
      expect(res.statusCode).toBe(502)
      expect(res.headers.location).toBeUndefined()
    }
  })

  it('asks for the record once, however many downloads follow', async () => {
    for (let i = 0; i < 20; i++) expect((await call()).statusCode).toBe(302)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('404 while nothing is published, 502 when the record cannot be read', async () => {
    upstream = () => new Response('Not Found', { status: 404 })
    expect((await call()).statusCode).toBe(404)
    upstream = () => new Response('busy', { status: 503 })
    expect((await call()).statusCode).toBe(502)
    upstream = () => { throw new Error('offline') }
    expect((await call()).statusCode).toBe(502)
  })

  it('405 for anything but GET', async () => {
    expect((await call({}, 'POST')).statusCode).toBe(405)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
