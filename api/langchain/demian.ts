import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Annotation, MessagesAnnotation, StateGraph } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { createChatModel, type Provider } from '../lib/models'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools'

// ─── State ──────────────────────────────────────────

const DemianState = Annotation.Root({
  ...MessagesAnnotation.spec,
  memoContext: Annotation<string>({
    reducer: (_, y) => y ?? '',
    default: () => '',
  }),
  writingSamples: Annotation<string[]>({
    reducer: (_, y) => y ?? [],
    default: () => [],
  }),
  memoSummaries: Annotation<Array<{ id: number; title: string; body: string; tags: string[] }>>({
    reducer: (_, y) => y ?? [],
    default: () => [],
  }),
})

// ─── Tools ──────────────────────────────────────────

function createDemianTools(getMemos: () => Array<{ id: number; title: string; body: string; tags: string[] }>) {
  const searchMemos = tool(
    async ({ query }) => {
      const memos = getMemos()
      const queryLower = query.toLowerCase()
      const results = memos
        .filter(m => {
          const text = `${m.title} ${m.body} ${m.tags.join(' ')}`.toLowerCase()
          return queryLower.split(/\s+/).some(w => text.includes(w))
        })
        .slice(0, 5)
        .map(m => `[${m.title}] ${m.body.slice(0, 200)}`)

      return results.length > 0
        ? `관련 메모 ${results.length}개:\n${results.join('\n---\n')}`
        : '관련 메모를 찾지 못했습니다.'
    },
    {
      name: 'searchMemos',
      description: '사용자의 과거 메모를 키워드로 검색합니다. 이전 글에서 관련 내용을 찾을 때 사용합니다.',
      schema: z.object({
        query: z.string().describe('검색할 키워드 또는 주제'),
      }),
    }
  )

  const getWritingPatterns = tool(
    async () => {
      const memos = getMemos()
      if (memos.length === 0) return '아직 분석할 메모가 충분하지 않습니다.'

      const tagCounts = new Map<string, number>()
      for (const m of memos) {
        for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
      }

      const topTags = [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => `#${tag} (${count}회)`)

      const avgLength = Math.round(memos.reduce((s, m) => s + m.body.length, 0) / memos.length)

      return `총 메모: ${memos.length}개\n평균 길이: ${avgLength}자\n자주 쓰는 태그: ${topTags.join(', ')}`
    },
    {
      name: 'getWritingPatterns',
      description: '사용자의 글쓰기 패턴을 분석합니다. 자주 다루는 주제, 글의 길이 트렌드 등을 파악합니다.',
      schema: z.object({}),
    }
  )

  const findContradictions = tool(
    async ({ topic }) => {
      const memos = getMemos()
      const topicLower = topic.toLowerCase()
      const related = memos
        .filter(m => `${m.title} ${m.body}`.toLowerCase().includes(topicLower))
        .slice(0, 5)

      if (related.length < 2) return `"${topic}"에 대한 메모가 충분하지 않아 비교하기 어렵습니다.`

      return `"${topic}" 관련 메모 ${related.length}개:\n${related.map(m =>
        `- [${m.title}]: ${m.body.slice(0, 150)}`
      ).join('\n')}\n\n이 내용들 사이에서 변화나 모순을 찾아보세요.`
    },
    {
      name: 'findContradictions',
      description: '특정 주제에 대한 사용자의 과거 메모들을 비교하여 생각의 변화나 모순을 찾습니다.',
      schema: z.object({
        topic: z.string().describe('비교할 주제'),
      }),
    }
  )

  return [searchMemos, getWritingPatterns, findContradictions]
}

// ─── System Prompt ──────────────────────────────────

function buildSystemPrompt(writingSamples: string[]): string {
  const samples = writingSamples.slice(0, 10).join('\n---\n')

  return `당신은 사용자의 "또 다른 자아" 데미안입니다. 과거 글쓰기 스타일을 참고하되, 소크라테스식 문답법으로 대화합니다.

규칙:
1. 절대 쉽게 동의하지 않습니다. 항상 한 번 더 질문합니다.
2. "왜?"를 자주 묻습니다.
3. 과거 기록에서 모순이나 성장을 찾아 지적합니다 — 도구를 적극 활용하세요.
4. 격려할 때도 구체적 근거를 댑니다.
5. 한국어로 대화합니다.
6. 짧고 날카로운 문장을 사용합니다 (3문장 이내).
7. 사용자의 과거 메모를 검색하거나 글쓰기 패턴을 분석할 수 있습니다.

사용자의 과거 글쓰기 스타일 참고:
${samples}`
}

// ─── Graph Builder ──────────────────────────────────

function buildDemianGraph(provider: Provider, apiKey: string, memoSummaries: Array<{ id: number; title: string; body: string; tags: string[] }>) {
  const tools = createDemianTools(() => memoSummaries)
  const model = createChatModel(provider, apiKey, { temperature: 0.7, maxTokens: 300 })
  const modelWithTools = model.bindTools(tools)
  const toolNode = new ToolNode(tools)

  async function agentNode(state: typeof DemianState.State) {
    const systemPrompt = buildSystemPrompt(state.writingSamples)
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]

    // Add memo context as initial context if present
    if (state.memoContext && state.messages.length <= 1) {
      messages.splice(1, 0,
        new HumanMessage(`[현재 작성 중인 메모]\n${state.memoContext.slice(0, 1000)}`),
        new AIMessage('흥미로운 글이네요. 계속해 보죠.')
      )
    }

    const result = await modelWithTools.invoke(messages)
    return { messages: [result] }
  }

  function shouldContinue(state: typeof DemianState.State) {
    const lastMessage = state.messages[state.messages.length - 1]
    if (lastMessage && 'tool_calls' in lastMessage && Array.isArray((lastMessage as AIMessage).tool_calls) && (lastMessage as AIMessage).tool_calls!.length > 0) {
      return 'tools'
    }
    return '__end__'
  }

  const graph = new StateGraph(DemianState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      __end__: '__end__',
    })
    .addEdge('tools', 'agent')
    .compile()

  return graph
}

// ─── API Handler ────────────────────────────────────

export default createHandler(async (req: VercelRequest, res: VercelResponse) => {
  const {
    messages = [],
    currentBody = '',
    writingSamples = [],
    memoSummaries = [],
    provider = 'openai',
    userApiKey,
  } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse(res, 400, 'messages array is required')
  }

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) {
    return errorResponse(res, 500, `${provider} API key not configured`)
  }

  const usingServerKey = !userApiKey

  // Convert message objects to LangChain messages
  const langchainMessages: BaseMessage[] = messages.map((m: { role: string; content: string }) => {
    if (m.role === 'assistant') return new AIMessage(m.content)
    return new HumanMessage(m.content)
  })

  const graph = buildDemianGraph(
    provider as Provider,
    apiKey,
    Array.isArray(memoSummaries) ? memoSummaries : []
  )

  const result = await graph.invoke({
    messages: langchainMessages,
    memoContext: currentBody || '',
    writingSamples: Array.isArray(writingSamples) ? writingSamples : [],
    memoSummaries: Array.isArray(memoSummaries) ? memoSummaries : [],
  })

  // Extract the last AI message
  const lastMessage = result.messages[result.messages.length - 1]
  const text = typeof lastMessage.content === 'string' ? lastMessage.content : ''

  return res.status(200).json({ text, usingServerKey })
})
