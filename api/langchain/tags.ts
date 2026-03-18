import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, type Provider } from '../lib/models'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools'

export default createHandler(async (req, res) => {
  const { content, provider = 'openai', userApiKey } = req.body || {}
  if (!content || content.length < 20) return res.json({ tags: [], usingServerKey: false })

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) return errorResponse(res, 500, `${provider} API key not configured`)

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.3, maxTokens: 200 })

  const response = await model.invoke([
    new SystemMessage(
      `You are a tag suggestion assistant for a Korean memo app. Given the memo content, suggest 3-5 relevant tags in Korean. Return ONLY a JSON array of strings. Example: ["프로젝트","아이디어","개발"]`
    ),
    new HumanMessage(content.slice(0, 1000)),
  ])

  const text = typeof response.content === 'string' ? response.content : ''
  let tags: string[] = []

  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) {
        tags = parsed.filter((t): t is string => typeof t === 'string').slice(0, 5)
      }
    }
  } catch { /* fallback to empty */ }

  return res.json({ tags, usingServerKey })
})
