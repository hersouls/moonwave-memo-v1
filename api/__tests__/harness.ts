// Minimal fake VercelRequest/VercelResponse for driving handlers in tests.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface FakeRes {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  headersSent: boolean
  status(code: number): FakeRes
  json(body: unknown): FakeRes
  setHeader(name: string, value: string | number): FakeRes
  end(): FakeRes
}

export function fakeRes(): FakeRes {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    headersSent: false,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; this.headersSent = true; return this },
    setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); return this },
    end() { this.headersSent = true; return this },
  }
}

export type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>

export async function callHandler(
  handler: Handler,
  opts: { token?: string; body?: unknown; method?: string; headers?: Record<string, string> },
): Promise<FakeRes> {
  const req = {
    method: opts.method ?? 'POST',
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...opts.headers },
    body: opts.body,
    query: {},
  } as unknown as VercelRequest
  const res = fakeRes()
  await handler(req, res as unknown as VercelResponse)
  return res
}
