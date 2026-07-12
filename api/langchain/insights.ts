import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, type Provider } from '../lib/models'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools'
import { applyCors } from '../lib/cors'

// ─── AI Insights Endpoint ───────────────────────────

interface MemoInput {
  title: string
  body: string
  tags: string[]
  createdAt: string
}

export default createHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (applyCors(req, res)) return
  const {
    memos = [],
    provider = 'openai',
    userApiKey,
  } = req.body || {}

  if (!Array.isArray(memos) || memos.length < 3) {
    return errorResponse(res, 400, 'At least 3 memos required for insights')
  }

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) {
    return errorResponse(res, 500, `${provider} API key not configured`)
  }

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.5, maxTokens: 800 })

  const memoData = (memos as MemoInput[]).slice(0, 30)
  const memoSummary = memoData
    .map((m, i) => `${i + 1}. [${m.title}] ${m.body.slice(0, 100)} (태그: ${m.tags.join(',')}, ${m.createdAt.slice(0, 10)})`)
    .join('\n')

  const result = await model.invoke([
    new SystemMessage(`당신은 개인 메모 앱의 인사이트 분석 AI입니다. 사용자의 메모 패턴을 분석하여 의미 있는 인사이트를 발견합니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "insights": [
    {"text": "인사이트 텍스트", "type": "pattern|streak|tag|time|growth|mood"},
    ...
  ]
}

인사이트 유형:
- pattern: 반복되는 패턴이나 습관
- streak: 연속 기록 관련
- tag: 태그 사용 패턴
- time: 시간대 패턴
- growth: 성장이나 변화
- mood: 감정 패턴

규칙:
- 한국어로 작성
- 최대 5개의 인사이트
- 각 인사이트는 1문장, 구체적 데이터 포함
- 단순한 통계보다 의미 있는 관찰에 집중
- JSON 외의 텍스트를 포함하지 마세요`),
    new HumanMessage(`총 ${memoData.length}개 메모 분석:\n${memoSummary}`),
  ])

  try {
    const text = typeof result.content === 'string' ? result.content : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (parsed.insights && Array.isArray(parsed.insights)) {
        return res.status(200).json({
          insights: parsed.insights
            .filter((i: { text?: string; type?: string }) => i.text && i.type)
            .slice(0, 5),
          usingServerKey,
        })
      }
    }
  } catch { /* parse error */ }

  return res.status(200).json({ insights: [], usingServerKey })
})
