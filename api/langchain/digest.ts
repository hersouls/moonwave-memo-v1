import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, type Provider } from '../lib/models'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools'

// ─── AI Weekly Digest Endpoint ──────────────────────

interface MemoInput {
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export default createHandler(async (req: VercelRequest, res: VercelResponse) => {
  const {
    weeklyMemos = [],
    provider = 'openai',
    userApiKey,
  } = req.body || {}

  if (!Array.isArray(weeklyMemos) || weeklyMemos.length === 0) {
    return errorResponse(res, 400, 'weeklyMemos array is required')
  }

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) {
    return errorResponse(res, 500, `${provider} API key not configured`)
  }

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.5, maxTokens: 1000 })

  const memos = weeklyMemos as MemoInput[]
  const memoList = memos
    .slice(0, 20)
    .map((m, i) => `${i + 1}. [${m.title}] ${m.body.slice(0, 200)} (태그: ${m.tags.join(', ')}, 작성: ${m.createdAt.slice(0, 10)})`)
    .join('\n')

  const allTags = memos.flatMap(m => m.tags)
  const tagCounts = new Map<string, number>()
  for (const t of allTags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const result = await model.invoke([
    new SystemMessage(`당신은 개인 메모 앱의 주간 다이제스트 AI입니다. 이번 주 메모를 종합 분석하여 주간 리포트를 생성합니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "summary": "이번 주 활동 요약 (2-3문장)",
  "themes": ["주요 테마1", "주요 테마2", "주요 테마3"],
  "moodTrend": "감정 변화 트렌드 설명 (1문장)",
  "growth": "성장이나 변화 관찰 (1문장)",
  "topInsights": ["인사이트1", "인사이트2"],
  "nextWeekSuggestion": "다음 주 제안 (1문장)"
}

규칙:
- 한국어로 작성
- 메모 내용을 기반으로 구체적으로 작성
- 긍정적이지만 정직한 톤
- themes는 최대 5개
- topInsights는 최대 3개
- JSON 외의 텍스트를 포함하지 마세요`),
    new HumanMessage(`이번 주 메모 ${memos.length}개:\n${memoList}\n\n주요 태그: ${topTags.map(([t, c]) => `#${t}(${c})`).join(', ')}`),
  ])

  try {
    const text = typeof result.content === 'string' ? result.content : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return res.status(200).json({ digest: parsed, usingServerKey })
    }
  } catch { /* parse error */ }

  return res.status(200).json({
    digest: {
      summary: `이번 주에 ${memos.length}개의 메모를 작성했습니다.`,
      themes: topTags.slice(0, 3).map(([t]) => t),
      moodTrend: '',
      growth: '',
      topInsights: [],
      nextWeekSuggestion: '',
    },
    usingServerKey,
  })
})
