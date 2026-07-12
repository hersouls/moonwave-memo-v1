import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, createEmbeddingModel, type Provider } from '../lib/models.js'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools.js'

// ─── Cosine Similarity ──────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ─── RAG Search Endpoint ────────────────────────────

interface MemoSummary {
  id: number
  title: string
  body: string
  tags: string[]
  embedding?: number[]
}

export default createHandler(async (req: VercelRequest, res: VercelResponse) => {
  const { query, memoSummaries = [], provider = 'openai', userApiKey, topK = 10 } = req.body || {}

  if (!query || typeof query !== 'string') {
    return errorResponse(res, 400, 'query is required')
  }

  if (!Array.isArray(memoSummaries) || memoSummaries.length === 0) {
    return errorResponse(res, 400, 'memoSummaries array is required')
  }

  const openaiKey = resolveApiKey('openai', userApiKey)
  if (!openaiKey) {
    return errorResponse(res, 500, 'OpenAI API key not configured for embeddings')
  }

  const usingServerKey = !userApiKey

  // Step 1: Compute query embedding
  const embeddings = createEmbeddingModel(openaiKey)
  const queryEmbedding = await embeddings.embedQuery(query.slice(0, 500))

  // Step 2: Semantic similarity scoring
  const scored = (memoSummaries as MemoSummary[])
    .map((memo) => {
      let semanticScore = 0
      if (memo.embedding && Array.isArray(memo.embedding)) {
        semanticScore = cosineSimilarity(queryEmbedding, memo.embedding)
      }

      // Keyword match score (simple)
      const queryLower = query.toLowerCase()
      const textLower = `${memo.title} ${memo.body} ${memo.tags.join(' ')}`.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1)
      const keywordScore = queryWords.length > 0
        ? queryWords.filter(w => textLower.includes(w)).length / queryWords.length
        : 0

      // Hybrid score: 70% semantic + 30% keyword
      const hybridScore = semanticScore * 0.7 + keywordScore * 0.3

      return { ...memo, semanticScore, keywordScore, hybridScore }
    })
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, Math.min(topK * 2, 20)) // Get 2x topK for re-ranking

  // Step 3: LLM re-ranking (if enough results and API key available)
  if (scored.length > 3) {
    const chatApiKey = resolveApiKey(provider as Provider, userApiKey)
    if (chatApiKey) {
      try {
        const model = createChatModel(provider as Provider, chatApiKey, { temperature: 0, maxTokens: 300 })
        const candidateList = scored.slice(0, 10).map((m, i) =>
          `[${i}] "${m.title}" - ${m.body.slice(0, 100)}... (tags: ${m.tags.join(', ')})`
        ).join('\n')

        const result = await model.invoke([
          new SystemMessage(`You are a search result re-ranker. Given a query and search results, return the indices of the most relevant results in order of relevance. Return ONLY a JSON array of indices like [2,0,5,1]. Maximum ${topK} items.`),
          new HumanMessage(`Query: "${query}"\n\nResults:\n${candidateList}`),
        ])

        const text = typeof result.content === 'string' ? result.content : ''
        const match = text.match(/\[[\s\S]*?\]/)
        if (match) {
          const indices: number[] = JSON.parse(match[0])
          const reranked = indices
            .filter(i => typeof i === 'number' && i >= 0 && i < scored.length)
            .slice(0, topK)
            .map(i => scored[i])

          if (reranked.length > 0) {
            return res.status(200).json({
              results: reranked.map(({ embedding: _, ...rest }) => rest),
              reranked: true,
              usingServerKey,
            })
          }
        }
      } catch {
        // Re-ranking failed, fall through to hybrid-only results
      }
    }
  }

  // Fallback: return hybrid-scored results
  return res.status(200).json({
    results: scored.slice(0, topK).map(({ embedding: _, ...rest }) => rest),
    reranked: false,
    usingServerKey,
  })
})
