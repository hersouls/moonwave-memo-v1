import { useSettingsStore } from '@/stores/settingsStore'
import { auth, callable } from '@/lib/firebase'

// ─── Embedding Service ──────────────────────────────
// Computes and caches text embeddings via OpenAI text-embedding-3-small

interface EmbeddingCache {
  vector: number[]
  computedAt: string
}

interface EmbeddingResponse {
  embedding: number[]
}

// Cloud Functions callable for embedding
const aiEmbeddingFn = callable<
  { text: string },
  EmbeddingResponse
>('aiEmbedding')

// ─── Direct OpenAI embedding API call ───────────────

async function callOpenAIEmbedding(text: string): Promise<number[] | null> {
  const openaiKey = useSettingsStore.getState().settings.ai.openaiApiKey
  if (!openaiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 2000),
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    return data.data?.[0]?.embedding || null
  } catch {
    return null
  }
}

// ─── LangChain embedding endpoint ───────────────────

async function callLangChainEmbedding(text: string): Promise<number[] | null> {
  const openaiKey = useSettingsStore.getState().settings.ai.openaiApiKey

  try {
    const res = await fetch('/api/langchain/embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 2000),
        userApiKey: openaiKey || undefined,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.embedding || null
  } catch {
    return null
  }
}

// ─── Compute embedding: LangChain first, then proxy, then direct ──

export async function computeEmbedding(text: string): Promise<number[] | null> {
  if (!text.trim()) return null

  const truncated = text.slice(0, 2000)

  // Try LangChain endpoint first (uses LangSmith tracing)
  const langchainResult = await callLangChainEmbedding(truncated)
  if (langchainResult) return langchainResult

  // Try Cloud Functions proxy
  if (auth.currentUser) {
    try {
      const result = await aiEmbeddingFn({ text: truncated })
      if (result.data.embedding) return result.data.embedding
    } catch {
      // Fall through to direct API
    }
  }

  // Fallback: direct OpenAI API
  return callOpenAIEmbedding(truncated)
}

// ─── RAG-enhanced semantic search ───────────────────

export interface RAGSearchResult {
  id: number
  title: string
  body: string
  tags: string[]
  semanticScore: number
  keywordScore: number
  hybridScore: number
}

export async function semanticSearchWithRAG(
  query: string,
  memoSummaries: Array<{ id: number; title: string; body: string; tags: string[]; embedding?: number[] }>,
  topK = 10
): Promise<RAGSearchResult[]> {
  if (!query.trim() || memoSummaries.length === 0) return []

  const ai = useSettingsStore.getState().settings.ai
  const provider = ai.aiProvider || 'openai'
  const userApiKey = ai.openaiApiKey || ai.anthropicApiKey || ai.geminiApiKey || undefined

  try {
    const res = await fetch('/api/langchain/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, memoSummaries, provider, userApiKey, topK }),
    })

    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  } catch {
    return []
  }
}

// ─── Cached embedding retrieval ─────────────────────

export async function getOrComputeEmbedding(
  memoId: number,
  text: string,
  updatedAt: string
): Promise<number[] | null> {
  const cacheKey = `memo-embedding-${memoId}`

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed: EmbeddingCache = JSON.parse(cached)
      // If memo hasn't been updated since embedding was computed, use cache
      if (parsed.computedAt >= updatedAt && parsed.vector.length > 0) {
        return parsed.vector
      }
    }
  } catch {
    // Invalid cache, recompute
  }

  // Compute fresh embedding
  const vector = await computeEmbedding(text)
  if (!vector) return null

  // Cache it
  try {
    const cache: EmbeddingCache = {
      vector,
      computedAt: new Date().toISOString(),
    }
    localStorage.setItem(cacheKey, JSON.stringify(cache))
  } catch {
    // localStorage full or unavailable — ignore
  }

  return vector
}

// ─── Cosine similarity ──────────────────────────────

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

// ─── Check if API key is available ──────────────────

export function hasEmbeddingCapability(): boolean {
  const ai = useSettingsStore.getState().settings.ai
  return !!ai.openaiApiKey || !!auth.currentUser
}
