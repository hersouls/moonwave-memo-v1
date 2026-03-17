import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { auth, callable } from '@/lib/firebase'

// ─── Alter Ego (데미안) Co-Author Service ───────────

interface AIResponse {
  text: string
  error?: string
}

// Cloud Functions callable
const aiChatFn = callable<
  { prompt: string; systemPrompt: string; provider?: 'openai' | 'anthropic' },
  { text: string }
>('aiChat')

function getApiKeys() {
  const ai = useSettingsStore.getState().settings.ai
  return {
    openaiKey: ai.openaiApiKey,
    anthropicKey: ai.anthropicApiKey,
    geminiKey: ai.geminiApiKey,
  }
}

// ─── Build alter ego system prompt ──────────────────

export function buildAlterEgoSystemPrompt(): string {
  const memos = useMemoStore.getState().memos
    .filter((m) => !m.deletedAt && m.body.length > 100)
    .sort((a, b) => b.body.length - a.body.length)
    .slice(0, 10)

  const writingSamples = memos.map((m) => m.body.slice(0, 300)).join('\n---\n')

  return `당신은 사용자의 "또 다른 자아"입니다. 과거 글쓰기 스타일을 참고하되, 소크라테스식 문답법으로 대화합니다.

규칙:
1. 절대 쉽게 동의하지 않습니다. 항상 한 번 더 질문합니다.
2. "왜?"를 자주 묻습니다.
3. 과거 기록에서 모순이나 성장을 찾아 지적합니다.
4. 격려할 때도 구체적 근거를 댑니다.
5. 한국어로 대화합니다.
6. 짧고 날카로운 문장을 사용합니다 (3문장 이내).

사용자의 과거 글쓰기 스타일 참고:
${writingSamples}`
}

// ─── Cloud Functions proxy ──────────────────────────

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

// ─── Direct OpenAI call ─────────────────────────────

async function callOpenAI(messages: Array<{ role: string; content: string }>, maxTokens = 300): Promise<AIResponse> {
  const { openaiKey } = getApiKeys()
  if (!openaiKey) return { text: '', error: 'no-key' }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
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

// ─── Direct Anthropic call ──────────────────────────

async function callAnthropic(messages: Array<{ role: string; content: string }>, systemPrompt: string, maxTokens = 300): Promise<AIResponse> {
  const { anthropicKey } = getApiKeys()
  if (!anthropicKey) return { text: '', error: 'no-key' }

  try {
    // Filter out system messages for Anthropic API
    const anthropicMessages = messages.filter((m) => m.role !== 'system')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: anthropicMessages,
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

// ─── Direct Gemini call ─────────────────────────────

async function callGemini(messages: Array<{ role: string; content: string }>, systemPrompt: string, maxTokens = 300): Promise<AIResponse> {
  const { geminiKey } = getApiKeys()
  if (!geminiKey) return { text: '', error: 'no-key' }

  try {
    // Build Gemini contents from messages (skip system role)
    const userMessages = messages.filter((m) => m.role !== 'system')
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: lastUserMessage }] }],
          generationConfig: { maxOutputTokens: maxTokens * 4, temperature: 0.7 },
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

// ─── LangGraph Agent call ───────────────────────────

async function callLangGraphDemian(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentBody: string
): Promise<AIResponse> {
  const ai = useSettingsStore.getState().settings.ai
  const provider = ai.aiProvider || 'anthropic'
  const userApiKey = ai.openaiApiKey || ai.anthropicApiKey || ai.geminiApiKey || undefined

  // Gather writing samples and memo summaries for the agent
  const memos = useMemoStore.getState().memos.filter((m) => !m.deletedAt)
  const writingSamples = memos
    .filter((m) => m.body.length > 100)
    .sort((a, b) => b.body.length - a.body.length)
    .slice(0, 10)
    .map((m) => m.body.slice(0, 300))

  const memoSummaries = memos
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)
    .map((m) => ({
      id: m.id || 0,
      title: m.title,
      body: m.body.slice(0, 200),
      tags: m.tags,
    }))

  try {
    const res = await fetch('/api/langchain/demian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        currentBody: currentBody.slice(0, 1000),
        writingSamples,
        memoSummaries,
        provider,
        userApiKey,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { text: '', error: err.error || 'LangGraph agent 호출 실패' }
    }

    const data = await res.json()
    return { text: data.text || '' }
  } catch {
    return { text: '', error: 'langchain_unavailable' }
  }
}

// ─── Send alter ego message ─────────────────────────

export async function sendAlterEgoMessage(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentBody: string
): Promise<{ text: string; error?: string }> {
  // Try LangGraph Agent first (tool-calling, memo search capabilities)
  const agentResult = await callLangGraphDemian(conversationHistory, currentBody)
  if (!agentResult.error && agentResult.text) return agentResult

  // Fallback to legacy flow
  const systemPrompt = buildAlterEgoSystemPrompt()

  const contextMessage = currentBody.trim()
    ? `[현재 작성 중인 메모 내용]\n${currentBody.slice(0, 1000)}\n\n`
    : ''

  const fullPrompt = conversationHistory.length > 0
    ? conversationHistory[conversationHistory.length - 1].content
    : `${contextMessage}이 글에 대해 어떻게 생각하시나요?`

  // Try proxy
  const proxyResult = await callViaProxy(
    `${contextMessage}${fullPrompt}`,
    systemPrompt
  )
  if (!proxyResult.error) return proxyResult

  // Build full messages array for direct API calls
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...(contextMessage
      ? [{ role: 'user', content: `[현재 작성 중인 메모]\n${currentBody.slice(0, 1000)}` }, { role: 'assistant', content: '흥미로운 글이네요. 계속해 보죠.' }]
      : []),
    ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
  ]

  // Fallback to direct API calls (try all providers)
  const { openaiKey, anthropicKey, geminiKey } = getApiKeys()

  if (openaiKey) {
    const result = await callOpenAI(messages, 300)
    if (result.error !== 'no-key') return result
  }
  if (anthropicKey) {
    const result = await callAnthropic(messages, systemPrompt, 300)
    if (result.error !== 'no-key') return result
  }
  if (geminiKey) {
    const result = await callGemini(messages, systemPrompt, 300)
    if (result.error !== 'no-key') return result
  }

  if (proxyResult.error !== 'proxy-unavailable') {
    return proxyResult
  }

  return { text: '', error: 'AI 서비스를 사용하려면 로그인하거나 설정에서 API 키를 입력해 주세요.' }
}

// ─── Check if alter ego is available ────────────────

export function hasAlterEgoCapability(): boolean {
  const ai = useSettingsStore.getState().settings.ai
  return !!ai.openaiApiKey || !!ai.anthropicApiKey || !!ai.geminiApiKey || !!auth.currentUser
}
