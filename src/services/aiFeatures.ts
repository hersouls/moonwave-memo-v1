import { useSettingsStore } from '@/stores/settingsStore'
import { auth, callable } from '@/lib/firebase'

interface AIResponse {
  text: string
  error?: string
}

// B-03: Cloud Functions callable
const aiChatFn = callable<
  { prompt: string; systemPrompt: string; provider?: 'openai' | 'anthropic' },
  { text: string }
>('aiChat')

function getApiKeys() {
  const ai = useSettingsStore.getState().settings.ai
  return {
    openaiKey: ai.openaiApiKey,
    anthropicKey: ai.anthropicApiKey,
  }
}

// ─── Cloud Functions proxy ───────────────────────────

async function callViaProxy(prompt: string, systemPrompt: string): Promise<AIResponse> {
  if (!auth.currentUser) return { text: '', error: 'proxy-unavailable' }

  try {
    const result = await aiChatFn({ prompt, systemPrompt })
    return { text: result.data.text }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cloud Function 호출 실패'
    return { text: '', error: message }
  }
}

// ─── Direct API calls (fallback) ─────────────────────

async function callOpenAI(prompt: string, systemPrompt: string, maxTokens = 500): Promise<AIResponse> {
  const { openaiKey } = getApiKeys()
  if (!openaiKey) return { text: '', error: 'OpenAI API 키가 설정되지 않았습니다.' }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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

async function callAnthropic(prompt: string, systemPrompt: string, maxTokens = 500): Promise<AIResponse> {
  const { anthropicKey } = getApiKeys()
  if (!anthropicKey) return { text: '', error: 'Anthropic API 키가 설정되지 않았습니다.' }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
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

// ─── Unified AI call: proxy first, then direct fallback ──

async function callAI(prompt: string, systemPrompt: string, maxTokens = 500): Promise<AIResponse> {
  // Try Cloud Functions proxy first (secure, no client-side API keys)
  const proxyResult = await callViaProxy(prompt, systemPrompt)
  if (!proxyResult.error) return proxyResult

  // Fallback to direct API calls with user-provided keys
  const { openaiKey, anthropicKey } = getApiKeys()
  if (openaiKey) return callOpenAI(prompt, systemPrompt, maxTokens)
  if (anthropicKey) return callAnthropic(prompt, systemPrompt, maxTokens)

  // If proxy failed with a real error (not just unavailable), show it
  if (proxyResult.error !== 'proxy-unavailable') {
    return proxyResult
  }

  return { text: '', error: 'AI 서비스를 사용하려면 로그인하거나 설정에서 API 키를 입력해 주세요.' }
}

export async function suggestTags(content: string): Promise<{ tags: string[]; error?: string }> {
  if (!content.trim() || content.length < 20) return { tags: [] }

  const systemPrompt = `You are a tag suggestion assistant for a Korean memo app. Given the memo content, suggest 3-5 relevant tags in Korean. Return ONLY a JSON array of strings, no other text. Example: ["프로젝트","아이디어","개발"]`

  const result = await callAI(content.slice(0, 1000), systemPrompt)
  if (result.error) return { tags: [], error: result.error }

  try {
    const parsed = JSON.parse(result.text)
    if (Array.isArray(parsed)) {
      return { tags: parsed.filter((t): t is string => typeof t === 'string').slice(0, 5) }
    }
  } catch {
    // Try to extract tags from text
    const match = result.text.match(/\[.*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return { tags: parsed.filter((t): t is string => typeof t === 'string').slice(0, 5) }
        }
      } catch { /* ignore */ }
    }
  }

  return { tags: [] }
}

export async function summarizeMemo(content: string): Promise<{ summary: string; error?: string }> {
  if (!content.trim() || content.length < 50) return { summary: '' }

  const systemPrompt = `You are a summarization assistant for a Korean memo app. Summarize the given memo content in 2-3 concise sentences in Korean. Focus on the key points and main ideas. Return only the summary text.`

  const result = await callAI(content.slice(0, 3000), systemPrompt)
  if (result.error) return { summary: '', error: result.error }
  return { summary: result.text }
}

export async function autocomplete(_content: string, cursorContext: string): Promise<{ suggestion: string; error?: string }> {
  if (!cursorContext.trim() || cursorContext.length < 10) return { suggestion: '' }

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

  const systemPrompt = `You are a readability enhancement assistant for a memo app. Reformat the given memo content to improve readability using Markdown formatting. Rules:
- Use headings (##, ###) to organize sections
- Use bullet points or numbered lists where appropriate
- Use **bold** for key terms or important points
- Add proper paragraph spacing
- Do NOT add, remove, or change any information — only restructure and format
- Write in the same language as the input
- Return ONLY the reformatted content, no explanations`

  const result = await callAI(
    content.slice(0, 5000),
    systemPrompt,
    2000
  )
  if (result.error) return { enhanced: '', error: result.error }
  return { enhanced: result.text }
}

export async function classifyMemo(
  text: string,
  folderNames: string[]
): Promise<{ folder: string | null; tags: string[]; title: string; error?: string }> {
  if (!text.trim() || text.length < 5) return { folder: null, tags: [], title: '' }

  const systemPrompt = `You are a memo classification assistant for a Korean memo app. Given the user's raw text and the available folder list, classify it automatically.

Available folders: ${JSON.stringify(folderNames)}

Return ONLY valid JSON in this exact format:
{"folder": "folder name or null", "tags": ["tag1", "tag2"], "title": "short title"}

Rules:
- folder must be one of the available folders or null if none fits
- tags should be 1-3 relevant Korean tags without # prefix
- title should be a concise Korean title (under 30 chars)
- Do not add any text outside the JSON`

  const result = await callAI(text.slice(0, 1000), systemPrompt)
  if (result.error) return { folder: null, tags: [], title: '', error: result.error }

  try {
    const parsed = JSON.parse(result.text)
    return {
      folder: typeof parsed.folder === 'string' ? parsed.folder : null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 5) : [],
      title: typeof parsed.title === 'string' ? parsed.title : '',
    }
  } catch {
    return { folder: null, tags: [], title: '' }
  }
}
