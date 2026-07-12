import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { createChatModel, type Provider } from '../lib/models.js'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools.js'
import { applyCors } from '../lib/cors.js'

export default createHandler(async (req, res) => {
  if (applyCors(req, res)) return
  const { content, provider = 'openai', userApiKey } = req.body || {}
  if (!content || content.length < 50) return res.json({ summary: '', usingServerKey: false })

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) return errorResponse(res, 500, `${provider} API key not configured`)

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.3, maxTokens: 500 })
  const parser = new StringOutputParser()

  const result = await model.pipe(parser).invoke([
    new SystemMessage(
      `You are a summarization assistant for a Korean memo app. Summarize the given memo content in 2-3 concise sentences in Korean. Focus on the key points and main ideas. Return only the summary text.`
    ),
    new HumanMessage(content.slice(0, 3000)),
  ])

  return res.json({ summary: result.trim(), usingServerKey })
})
