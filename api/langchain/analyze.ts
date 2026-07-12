import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Annotation, StateGraph } from '@langchain/langgraph'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, type Provider } from '../lib/models.js'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools.js'
import { applyCors } from '../lib/cors.js'

// ─── State Definition ───────────────────────────────

const MemoAnalysisState = Annotation.Root({
  // Inputs
  content: Annotation<string>({
    reducer: (_, y) => y ?? '',
    default: () => '',
  }),
  folderNames: Annotation<string[]>({
    reducer: (_, y) => y ?? [],
    default: () => [],
  }),
  // Outputs
  sentiment: Annotation<{
    mood: string
    confidence: number
    emotions: string[]
  }>({
    reducer: (_, y) => y,
    default: () => ({ mood: 'neutral', confidence: 0, emotions: [] }),
  }),
  tags: Annotation<string[]>({
    reducer: (_, y) => y ?? [],
    default: () => [],
  }),
  classification: Annotation<{
    folder: string | null
    title: string
  }>({
    reducer: (_, y) => y,
    default: () => ({ folder: null, title: '' }),
  }),
  summary: Annotation<string>({
    reducer: (_, y) => y ?? '',
    default: () => '',
  }),
})

// ─── Node Functions ─────────────────────────────────

function createNodes(provider: Provider, apiKey: string) {
  const model = createChatModel(provider, apiKey, { temperature: 0.3, maxTokens: 500 })

  async function sentimentNode(state: typeof MemoAnalysisState.State) {
    if (!state.content || state.content.length < 10) {
      return { sentiment: { mood: 'neutral', confidence: 0, emotions: [] } }
    }

    const result = await model.invoke([
      new SystemMessage(`당신은 감정 분석 전문가입니다. 주어진 텍스트의 감정을 분석해주세요.

반드시 다음 JSON 형식으로만 응답하세요:
{"mood":"positive|neutral|negative","confidence":0.0~1.0,"emotions":["감정1","감정2"]}

규칙:
- mood: positive, neutral, negative 중 하나
- confidence: 0.0~1.0 사이의 확신도
- emotions: 감지된 구체적 감정 (한국어, 최대 3개)
- JSON 외의 텍스트를 포함하지 마세요`),
      new HumanMessage(state.content.slice(0, 1500)),
    ])

    try {
      const text = typeof result.content === 'string' ? result.content : ''
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        return {
          sentiment: {
            mood: ['positive', 'neutral', 'negative'].includes(parsed.mood) ? parsed.mood : 'neutral',
            confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
            emotions: Array.isArray(parsed.emotions) ? parsed.emotions.filter((e: unknown) => typeof e === 'string').slice(0, 3) : [],
          },
        }
      }
    } catch { /* parse error, use default */ }

    return { sentiment: { mood: 'neutral', confidence: 0, emotions: [] } }
  }

  async function tagNode(state: typeof MemoAnalysisState.State) {
    if (!state.content || state.content.length < 20) {
      return { tags: [] }
    }

    const result = await model.invoke([
      new SystemMessage(`You are a tag suggestion assistant for a Korean memo app. Given the memo content, suggest 3-5 relevant tags in Korean. Return ONLY a JSON array of strings, no other text. Example: ["프로젝트","아이디어","개발"]`),
      new HumanMessage(state.content.slice(0, 1000)),
    ])

    try {
      const text = typeof result.content === 'string' ? result.content : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return { tags: parsed.filter((t: unknown) => typeof t === 'string').slice(0, 5) }
        }
      }
    } catch { /* parse error */ }

    return { tags: [] }
  }

  async function classifyNode(state: typeof MemoAnalysisState.State) {
    if (!state.content || state.content.length < 5 || state.folderNames.length === 0) {
      return { classification: { folder: null, title: '' } }
    }

    const result = await model.invoke([
      new SystemMessage(`You are a memo classification assistant for a Korean memo app. Given the user's text and available folders, classify it.

Available folders: ${JSON.stringify(state.folderNames)}

Return ONLY valid JSON: {"folder": "folder name or null", "title": "short title"}

Rules:
- folder must be one of the available folders or null if none fits
- title should be a concise Korean title (under 30 chars)
- Do not add any text outside the JSON`),
      new HumanMessage(state.content.slice(0, 1000)),
    ])

    try {
      const text = typeof result.content === 'string' ? result.content : ''
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        return {
          classification: {
            folder: typeof parsed.folder === 'string' ? parsed.folder : null,
            title: typeof parsed.title === 'string' ? parsed.title : '',
          },
        }
      }
    } catch { /* parse error */ }

    return { classification: { folder: null, title: '' } }
  }

  async function summaryNode(state: typeof MemoAnalysisState.State) {
    if (!state.content || state.content.length < 50) {
      return { summary: '' }
    }

    const result = await model.invoke([
      new SystemMessage(`You are a summarization assistant for a Korean memo app. Summarize the given memo content in 2-3 concise sentences in Korean. Focus on the key points and main ideas. Return only the summary text.`),
      new HumanMessage(state.content.slice(0, 3000)),
    ])

    const text = typeof result.content === 'string' ? result.content.trim() : ''
    return { summary: text }
  }

  return { sentimentNode, tagNode, classifyNode, summaryNode }
}

// ─── Build and Compile Graph ────────────────────────

function buildGraph(provider: Provider, apiKey: string) {
  const { sentimentNode, tagNode, classifyNode, summaryNode } = createNodes(provider, apiKey)

  const graph = new StateGraph(MemoAnalysisState)
    .addNode('sentiment', sentimentNode)
    .addNode('tag', tagNode)
    .addNode('classify', classifyNode)
    .addNode('summary', summaryNode)
    .addEdge('__start__', 'sentiment')
    .addEdge('sentiment', 'tag')
    .addEdge('tag', 'classify')
    .addEdge('classify', 'summary')
    .addEdge('summary', '__end__')
    .compile()

  return graph
}

// ─── API Handler ────────────────────────────────────

export default createHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (applyCors(req, res)) return
  const { content, folderNames = [], provider = 'openai', userApiKey } = req.body || {}

  if (!content || typeof content !== 'string') {
    return errorResponse(res, 400, 'content is required')
  }

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) {
    return errorResponse(res, 500, `${provider} API key not configured`)
  }

  const usingServerKey = !userApiKey
  const graph = buildGraph(provider as Provider, apiKey)

  const result = await graph.invoke({
    content,
    folderNames: Array.isArray(folderNames) ? folderNames : [],
  })

  return res.status(200).json({
    sentiment: result.sentiment,
    tags: result.tags,
    classification: result.classification,
    summary: result.summary,
    usingServerKey,
  })
})
