import type { VercelRequest, VercelResponse } from '@vercel/node'
import analyze from '../_langchain/analyze.js'
import autocomplete from '../_langchain/autocomplete.js'
import briefing from '../_langchain/briefing.js'
import classify from '../_langchain/classify.js'
import demian from '../_langchain/demian.js'
import digest from '../_langchain/digest.js'
import embedding from '../_langchain/embedding.js'
import insights from '../_langchain/insights.js'
import readability from '../_langchain/readability.js'
import search from '../_langchain/search.js'
import stream from '../_langchain/stream.js'
import summarize from '../_langchain/summarize.js'
import tags from '../_langchain/tags.js'

/**
 * One function for every /api/langchain/<action> route. The Hobby plan allows 12 functions
 * per deployment, and each file under api/ is one, so the handlers live in api/_langchain/
 * (a leading underscore keeps a file out of the function list) and this router picks one.
 * Each handler still runs its own CORS, method and login gate (createHandler).
 */
type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>

const ACTIONS: Record<string, Handler> = {
  analyze, autocomplete, briefing, classify, demian, digest, embedding,
  insights, readability, search, stream, summarize, tags,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action
  const route = action && Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined
  if (!route) return res.status(404).json({ error: 'not found' })
  return route(req, res)
}
