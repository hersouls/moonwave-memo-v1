import { useSettingsStore } from '@/stores/settingsStore'

interface AIResponse {
  text: string
  error?: string
}

function getApiKeys() {
  const ai = useSettingsStore.getState().settings.ai
  return {
    openaiKey: ai.openaiApiKey,
    anthropicKey: ai.anthropicApiKey,
  }
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<AIResponse> {
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
        max_tokens: 500,
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

async function callAnthropic(prompt: string, systemPrompt: string): Promise<AIResponse> {
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
        max_tokens: 500,
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

async function callAI(prompt: string, systemPrompt: string): Promise<AIResponse> {
  const { openaiKey, anthropicKey } = getApiKeys()

  // Prefer OpenAI, fallback to Anthropic
  if (openaiKey) return callOpenAI(prompt, systemPrompt)
  if (anthropicKey) return callAnthropic(prompt, systemPrompt)
  return { text: '', error: 'AI 서비스를 사용하려면 설정에서 API 키를 입력해 주세요.' }
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
