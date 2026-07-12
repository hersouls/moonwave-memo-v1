import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { useUIStore } from '@/stores/uiStore'
import { incrementAIUsage, isAILimitReached } from './aiUsage'
import { generateCacheKey, getCached, setCache } from '@/utils/promptCache'
import { streamFetch } from '@/utils/streamFetch'
import { apiUrl } from '@/lib/apiBase'
import type { AIProvider } from '@/lib/types'

interface AIResponse {
  text: string
  error?: string
}

function getAISettings() {
  const ai = useSettingsStore.getState().settings.ai
  return {
    openaiKey: ai.openaiApiKey,
    anthropicKey: ai.anthropicApiKey,
    geminiKey: ai.geminiApiKey,
    provider: ai.aiProvider || 'anthropic',
  }
}

function getUserApiKey(provider: AIProvider): string | undefined {
  const { openaiKey, anthropicKey, geminiKey } = getAISettings()
  switch (provider) {
    case 'openai': return openaiKey || undefined
    case 'anthropic': return anthropicKey || undefined
    case 'gemini': return geminiKey || undefined
  }
}

function hasAnyUserKey(): boolean {
  const { openaiKey, anthropicKey, geminiKey } = getAISettings()
  return !!(openaiKey || anthropicKey || geminiKey)
}

// ─── Direct API calls (when user has their own key) ─────

async function callOpenAIDirect(apiKey: string, prompt: string, systemPrompt: string, maxTokens: number): Promise<AIResponse> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { text: '', error: err.error?.message || `API 오류: ${res.status}` }
    }
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content?.trim() || '' }
  } catch (err) {
    return { text: '', error: `요청 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` }
  }
}

async function callAnthropicDirect(apiKey: string, prompt: string, systemPrompt: string, maxTokens: number): Promise<AIResponse> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { text: '', error: err.error?.message || `API 오류: ${res.status}` }
    }
    const data = await res.json()
    const textBlock = data.content?.find((c: { type: string }) => c.type === 'text')
    return { text: textBlock?.text?.trim() || '' }
  } catch (err) {
    return { text: '', error: `요청 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` }
  }
}

async function callGeminiDirect(apiKey: string, prompt: string, systemPrompt: string, maxTokens: number): Promise<AIResponse> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens * 4, temperature: 0.3 },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { text: '', error: err.error?.message || `API 오류: ${res.status}` }
    }
    const data = await res.json()
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '' }
  } catch (err) {
    return { text: '', error: `요청 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` }
  }
}

// ─── Server proxy call (uses Vercel API route with server keys) ──

async function callViaServerProxy(prompt: string, systemPrompt: string, provider: AIProvider, maxTokens: number): Promise<AIResponse> {
  // Check daily limit before calling
  if (isAILimitReached()) {
    useToastStore.getState().showToast(
      '오늘의 무료 AI 사용 횟수(50회)를 초과했습니다',
      'warning',
      { action: { label: 'API 키 등록', onClick: () => useUIStore.getState().openSettingsModal() } }
    )
    return { text: '', error: 'daily_limit_exceeded' }
  }

  try {
    const res = await fetch(apiUrl('/api/ai'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemPrompt, provider, maxTokens }),
    })

    if (res.status === 429) {
      useToastStore.getState().showToast(
        '오늘의 무료 AI 사용 횟수를 초과했습니다',
        'warning',
        { action: { label: 'API 키 등록', onClick: () => useUIStore.getState().openSettingsModal() } }
      )
      return { text: '', error: 'daily_limit_exceeded' }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { text: '', error: err.error || `서버 오류: ${res.status}` }
    }

    const data = await res.json()
    // Count usage if server key was used
    if (data.usingServerKey) incrementAIUsage()
    return { text: data.text || '' }
  } catch (err) {
    return { text: '', error: `서버 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` }
  }
}

// ─── Unified AI call: user key first, then server proxy ──

async function callAI(prompt: string, systemPrompt: string, maxTokens = 500): Promise<AIResponse> {
  const { provider } = getAISettings()
  const userKey = getUserApiKey(provider)

  // 1. User has their own API key → direct call (unlimited)
  if (userKey) {
    switch (provider) {
      case 'anthropic': return callAnthropicDirect(userKey, prompt, systemPrompt, maxTokens)
      case 'gemini': return callGeminiDirect(userKey, prompt, systemPrompt, maxTokens)
      default: return callOpenAIDirect(userKey, prompt, systemPrompt, maxTokens)
    }
  }

  // 2. No user key → server proxy (daily limited)
  return callViaServerProxy(prompt, systemPrompt, provider, maxTokens)
}

// ─── LangChain endpoint helper ──────────────────────────

async function callLangChain<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; usingServerKey: boolean }> {
  const { provider } = getAISettings()
  const userApiKey = getUserApiKey(provider)

  if (!userApiKey && isAILimitReached()) {
    return { data: null, usingServerKey: false }
  }

  try {
    const res = await fetch(apiUrl(`/api/langchain/${endpoint}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, provider, userApiKey }),
    })
    if (!res.ok) return { data: null, usingServerKey: false }
    const data = await res.json()
    if (data.usingServerKey) incrementAIUsage()
    return { data, usingServerKey: !!data.usingServerKey }
  } catch {
    return { data: null, usingServerKey: false }
  }
}

// ─── LangGraph Analysis Pipeline ────────────────────────

export interface MemoAnalysisResult {
  sentiment: { mood: string; confidence: number; emotions: string[] }
  tags: string[]
  classification: { folder: string | null; title: string }
  summary: string
}

export async function analyzeMemo(
  content: string,
  folderNames: string[] = []
): Promise<{ result: MemoAnalysisResult | null; error?: string }> {
  if (!content.trim() || content.length < 20) return { result: null }

  const { provider } = getAISettings()
  const userApiKey = getUserApiKey(provider)

  try {
    const res = await fetch(apiUrl('/api/langchain/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.slice(0, 3000),
        folderNames,
        provider,
        userApiKey,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { result: null, error: err.error || `서버 오류: ${res.status}` }
    }

    const data = await res.json()
    if (data.usingServerKey) incrementAIUsage()

    return {
      result: {
        sentiment: data.sentiment,
        tags: data.tags,
        classification: data.classification,
        summary: data.summary,
      },
    }
  } catch {
    // LangGraph endpoint unavailable, return null to trigger fallback
    return { result: null, error: 'langchain_unavailable' }
  }
}

// ─── Public API ─────────────────────────────────────────

export function isAIAvailable(): boolean {
  return hasAnyUserKey() || !isAILimitReached()
}

export async function suggestTags(content: string): Promise<{ tags: string[]; error?: string }> {
  if (!content.trim() || content.length < 20) return { tags: [] }

  const cacheKey = generateCacheKey('suggestTags', content)
  const cached = getCached<{ tags: string[] }>(cacheKey)
  if (cached) return cached

  // Try LangChain endpoint first
  const { data } = await callLangChain<{ tags: string[] }>('tags', { content: content.slice(0, 1000) })
  if (data?.tags && data.tags.length > 0) {
    const result = { tags: data.tags }
    setCache(cacheKey, result)
    return result
  }

  // Fallback to direct call
  const systemPrompt = `You are a tag suggestion assistant for a Korean memo app. Given the memo content, suggest 3-5 relevant tags in Korean. Return ONLY a JSON array of strings, no other text. Example: ["프로젝트","아이디어","개발"]`

  const aiResult = await callAI(content.slice(0, 1000), systemPrompt)
  if (aiResult.error) return { tags: [], error: aiResult.error }

  try {
    const match = aiResult.text.match(/\[[\s\S]*\]/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) {
        const result = { tags: parsed.filter((t): t is string => typeof t === 'string').slice(0, 5) }
        setCache(cacheKey, result)
        return result
      }
    }
  } catch { /* ignore */ }

  return { tags: [] }
}

export async function summarizeMemo(content: string): Promise<{ summary: string; error?: string }> {
  if (!content.trim() || content.length < 50) return { summary: '' }

  const cacheKey = generateCacheKey('summarize', content)
  const cached = getCached<{ summary: string }>(cacheKey)
  if (cached) return cached

  // Try LangChain endpoint first
  const { data } = await callLangChain<{ summary: string }>('summarize', { content: content.slice(0, 3000) })
  if (data?.summary) {
    const result = { summary: data.summary }
    setCache(cacheKey, result)
    return result
  }

  // Fallback to direct call
  const systemPrompt = `You are a summarization assistant for a Korean memo app. Summarize the given memo content in 2-3 concise sentences in Korean. Focus on the key points and main ideas. Return only the summary text.`

  const aiResult = await callAI(content.slice(0, 3000), systemPrompt)
  if (aiResult.error) return { summary: '', error: aiResult.error }
  const result = { summary: aiResult.text }
  setCache(cacheKey, result)
  return result
}

// 카테고리별 제목용 초단문 요약(띄어쓰기 포함 20자 이내). 실패/키없음 시 빈 문자열 → 규칙 기반으로 폴백.
export async function summarizeTitleKeyword(content: string): Promise<{ keyword: string; error?: string }> {
  if (!content.trim() || content.length < 10) return { keyword: '' }

  const cacheKey = generateCacheKey('titleKeyword', content)
  const cached = getCached<{ keyword: string }>(cacheKey)
  if (cached) return cached

  const systemPrompt = `You are a title-phrase generator for a Korean memo app. Read the memo content and produce ONE very short Korean phrase capturing its core topic. Rules:
- Korean, at most 20 characters INCLUDING spaces (fewer is better)
- Nouns/keywords only — no verbs endings, no punctuation, no quotes, no markdown, no line breaks
- Do NOT include the folder name, date, or brackets
- Return ONLY the phrase itself, nothing else
Example: content about reviewing the legal terms of a PPA contract → "법률 검토"`

  const aiResult = await callAI(content.slice(0, 1500), systemPrompt, 40)
  if (aiResult.error) return { keyword: '', error: aiResult.error }

  const keyword = aiResult.text.replace(/["'`]/g, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20).trim()
  const result = { keyword }
  setCache(cacheKey, result)
  return result
}

export async function autocomplete(_content: string, cursorContext: string): Promise<{ suggestion: string; error?: string }> {
  if (!cursorContext.trim() || cursorContext.length < 10) return { suggestion: '' }

  // Try LangChain endpoint first (no caching — content changes constantly)
  const { data } = await callLangChain<{ suggestion: string }>('autocomplete', { cursorContext: cursorContext.slice(-500) })
  if (data?.suggestion) return { suggestion: data.suggestion }

  // Fallback to direct call
  const systemPrompt = `You are an autocomplete assistant for a Korean memo app. Given the current text context, suggest a natural continuation (1-2 sentences). Return ONLY the suggested text to append, nothing else. Write in the same language as the input.`

  const result = await callAI(
    `Complete the following text naturally:\n\n${cursorContext.slice(-500)}`,
    systemPrompt
  )
  if (result.error) return { suggestion: '', error: result.error }
  return { suggestion: result.text }
}

export async function enhanceReadability(content: string): Promise<{ enhanced: string; error?: string }> {
  if (!content.trim() || content.length < 20) return { enhanced: '' }

  const cacheKey = generateCacheKey('readability', content)
  const cached = getCached<{ enhanced: string }>(cacheKey)
  if (cached) return cached

  // Try LangChain endpoint first
  const { data } = await callLangChain<{ enhanced: string }>('readability', { content: content.slice(0, 5000) })
  if (data?.enhanced) {
    const result = { enhanced: data.enhanced }
    setCache(cacheKey, result)
    return result
  }

  // Fallback to direct call
  const systemPrompt = `You are a readability enhancement assistant for a memo app. Reformat the given memo content to improve readability using Markdown formatting. Rules:
- Use headings (##, ###) to organize sections
- Use bullet points or numbered lists where appropriate
- Use **bold** for key terms or important points
- Add proper paragraph spacing
- Do NOT add, remove, or change any information — only restructure and format
- Write in the same language as the input
- Return ONLY the reformatted content, no explanations`

  const result = await callAI(content.slice(0, 5000), systemPrompt, 2000)
  if (result.error) return { enhanced: '', error: result.error }
  const enhancedResult = { enhanced: result.text }
  setCache(cacheKey, enhancedResult)
  return enhancedResult
}

export async function enhanceReadabilityStream(
  content: string,
  onChunk: (text: string) => void,
): Promise<{ error?: string }> {
  if (!content.trim() || content.length < 20) return {}

  const { provider } = getAISettings()
  const userApiKey = getUserApiKey(provider)

  if (!userApiKey && isAILimitReached()) {
    return { error: 'daily_limit_exceeded' }
  }

  try {
    const { usingServerKey } = await streamFetch(
      '/api/langchain/stream',
      { content: content.slice(0, 5000), task: 'readability', provider, userApiKey },
      onChunk,
    )
    if (usingServerKey) incrementAIUsage()
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Stream failed' }
  }
}

export async function classifyMemo(
  text: string,
  folderNames: string[]
): Promise<{ folder: string | null; tags: string[]; title: string; error?: string }> {
  if (!text.trim() || text.length < 5) return { folder: null, tags: [], title: '' }

  const cacheKey = generateCacheKey('classify', text + folderNames.join(','))
  const cached = getCached<{ folder: string | null; tags: string[]; title: string }>(cacheKey)
  if (cached) return cached

  // Try LangChain endpoint first
  const { data } = await callLangChain<{ folder: string | null; tags: string[]; title: string }>(
    'classify',
    { content: text.slice(0, 1000), folderNames },
  )
  if (data && (data.folder || data.tags?.length || data.title)) {
    setCache(cacheKey, data)
    return data
  }

  // Fallback to direct call
  const systemPrompt = `You are a memo classification assistant for a Korean memo app. Given the user's raw text and the available folder list, classify it automatically.

Available folders: ${JSON.stringify(folderNames)}

Return ONLY valid JSON in this exact format:
{"folder": "folder name or null", "tags": ["tag1", "tag2"], "title": "short title"}

Rules:
- folder must be one of the available folders or null if none fits
- tags should be 1-3 relevant Korean tags without # prefix
- title should be a concise Korean title (under 30 chars)
- Do not add any text outside the JSON`

  const aiResult = await callAI(text.slice(0, 1000), systemPrompt)
  if (aiResult.error) return { folder: null, tags: [], title: '', error: aiResult.error }

  try {
    const parsed = JSON.parse(aiResult.text)
    const result = {
      folder: typeof parsed.folder === 'string' ? parsed.folder : null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 5) : [],
      title: typeof parsed.title === 'string' ? parsed.title : '',
    }
    setCache(cacheKey, result)
    return result
  } catch {
    return { folder: null, tags: [], title: '' }
  }
}
