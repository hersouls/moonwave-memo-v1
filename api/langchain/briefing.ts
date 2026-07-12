import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, type Provider } from '../lib/models'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools'
import { applyCors } from '../lib/cors'

// ─── AI Daily Briefing Endpoint ─────────────────────

interface MemoInput {
  title: string
  body: string
  tags: string[]
  createdAt: string
}

export default createHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (applyCors(req, res)) return
  const {
    recentMemos = [],
    pendingTodos = [],
    currentStreak = 0,
    provider = 'openai',
    userApiKey,
  } = req.body || {}

  if (!Array.isArray(recentMemos) || recentMemos.length === 0) {
    return errorResponse(res, 400, 'recentMemos array is required')
  }

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) {
    return errorResponse(res, 500, `${provider} API key not configured`)
  }

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.5, maxTokens: 800 })

  const memoSummary = (recentMemos as MemoInput[])
    .slice(0, 10)
    .map((m, i) => `${i + 1}. [${m.title}] ${m.body.slice(0, 150)} (태그: ${m.tags.join(', ')})`)
    .join('\n')

  const todoList = (pendingTodos as string[]).slice(0, 10).join('\n- ')

  const result = await model.invoke([
    new SystemMessage(`당신은 개인 메모 앱의 AI 브리핑 어시스턴트입니다. 사용자의 최근 메모와 할 일을 분석하여 하루 브리핑을 생성합니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "greeting": "간단한 인사와 어제 활동 요약 (1문장)",
  "moodSummary": "전반적인 감정 분위기 요약 (1문장)",
  "keyTopics": ["주요 주제1", "주요 주제2"],
  "pendingActions": ["미완료 항목1", "미완료 항목2"],
  "todayFocus": "오늘 집중하면 좋을 것 (1문장)",
  "encouragement": "격려 메시지 (1문장)"
}

규칙:
- 한국어로 작성
- 간결하고 따뜻한 톤
- 실제 메모 내용을 기반으로 구체적으로 작성
- JSON 외의 텍스트를 포함하지 마세요`),
    new HumanMessage(`최근 메모 목록:\n${memoSummary}\n\n미완료 할 일:\n- ${todoList || '없음'}\n\n현재 연속 작성일: ${currentStreak}일`),
  ])

  try {
    const text = typeof result.content === 'string' ? result.content : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return res.status(200).json({ briefing: parsed, usingServerKey })
    }
  } catch { /* parse error */ }

  return res.status(200).json({
    briefing: {
      greeting: `최근 ${(recentMemos as MemoInput[]).length}개의 메모를 작성했습니다.`,
      moodSummary: '',
      keyTopics: [],
      pendingActions: pendingTodos || [],
      todayFocus: '',
      encouragement: currentStreak >= 3 ? `${currentStreak}일 연속 작성 중입니다!` : '',
    },
    usingServerKey,
  })
})
