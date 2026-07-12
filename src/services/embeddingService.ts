import { useSettingsStore } from '@/stores/settingsStore'
import { auth, callable } from '@/lib/firebase'
import { apiUrl } from '@/lib/apiBase'
import { db } from './database'

// ─── Embedding Service ──────────────────────────────
// Computes and caches text embeddings via OpenAI text-embedding-3-small

interface EmbeddingResponse {
  embedding: number[]
}

// One-time cleanup of the legacy localStorage embedding cache (~25KB/memo, never
// evicted) — it could exhaust the ~5MB origin quota and silently break other writers
// (the AI usage counter). Vectors now live in the far larger IndexedDB embeddings table.
let sweptLegacyCache = false
function sweepLegacyEmbeddingCache(): void {
  if (sweptLegacyCache) return
  sweptLegacyCache = true
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('memo-embedding-')) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch { /* best-effort */ }
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
    const res = await fetch(apiUrl('/api/langchain/embedding'), {
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
    const res = await fetch(apiUrl('/api/langchain/search'), {
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
  sweepLegacyEmbeddingCache()

  // Validate the cache by EXACT updatedAt equality (captured by the caller before the
  // fetch), not a wall-clock '>=' — the old comparison kept a stale vector forever if the
  // memo was edited while the embedding was in flight, or under cross-device clock skew.
  try {
    const cached = await db.embeddings.get(memoId)
    if (cached && cached.updatedAt === updatedAt && cached.vector.length > 0) {
      return cached.vector
    }
  } catch {
    // Cache read failed, recompute
  }

  // Compute fresh embedding
  const vector = await computeEmbedding(text)
  if (!vector) return null

  // Store in IndexedDB (large quota, replaces in place, cleaned up on memo delete).
  try {
    await db.embeddings.put({ memoId, updatedAt, vector })
  } catch {
    // storage unavailable — ignore
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
