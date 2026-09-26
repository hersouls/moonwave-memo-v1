// TEMPORARY diagnostic (removed right after use): which module fails to load on Vercel.
import type { VercelRequest, VercelResponse } from '@vercel/node'
const msg = (e: unknown) => { const x = e as { code?: string; message?: string }; return `${x?.code ?? ''} ${String(x?.message ?? e).slice(0, 400)}` }
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const out: Record<string, string> = {}
  try { await import('@langchain/core/messages'); out.core = 'ok' } catch (e) { out.core = msg(e) }
  try { await import('@langchain/openai'); out.openai = 'ok' } catch (e) { out.openai = msg(e) }
  try { await import('@langchain/anthropic'); out.anthropic = 'ok' } catch (e) { out.anthropic = msg(e) }
  try { await import('@langchain/google-genai'); out.genai = 'ok' } catch (e) { out.genai = msg(e) }
  try { await import('./lib/tracing.js'); out.tracing = 'ok' } catch (e) { out.tracing = msg(e) }
  try { await import('./lib/models.js'); out.models = 'ok' } catch (e) { out.models = msg(e) }
  try { await import('./lib/tools.js'); out.tools = 'ok' } catch (e) { out.tools = msg(e) }
  try { await import('./langchain/tags.js'); out.tags = 'ok' } catch (e) { out.tags = msg(e) }
  res.status(200).json({ node: process.version, out })
}
