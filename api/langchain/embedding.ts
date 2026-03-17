import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createEmbeddingModel } from '../lib/models'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools'

// ─── LangChain Embedding Endpoint ───────────────────

export default createHandler(async (req: VercelRequest, res: VercelResponse) => {
  const { text, userApiKey } = req.body || {}

  if (!text || typeof text !== 'string') {
    return errorResponse(res, 400, 'text is required')
  }

  // Embeddings use OpenAI regardless of provider preference
  const apiKey = resolveApiKey('openai', userApiKey)
  if (!apiKey) {
    return errorResponse(res, 500, 'OpenAI API key not configured for embeddings')
  }

  const usingServerKey = !userApiKey
  const embeddings = createEmbeddingModel(apiKey)
  const vector = await embeddings.embedQuery(text.slice(0, 2000))

  return res.status(200).json({ embedding: vector, usingServerKey })
})
