import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { createChatModel, type Provider } from '../lib/models.js'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools.js'
import { applyCors } from '../lib/cors.js'

export default createHandler(async (req, res) => {
  if (applyCors(req, res)) return
  const { cursorContext, provider = 'openai', userApiKey } = req.body || {}
  if (!cursorContext || cursorContext.length < 10) {
    return res.json({ suggestion: '', usingServerKey: false })
  }

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) return errorResponse(res, 500, `${provider} API key not configured`)

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.5, maxTokens: 100 })
  const parser = new StringOutputParser()

  const result = await model.pipe(parser).invoke([
    new SystemMessage(
      `You are an autocomplete assistant for a Korean memo app. Given the current text context, suggest a natural continuation (1-2 sentences). Return ONLY the suggested text to append, nothing else. Write in the same language as the input.`
    ),
    new HumanMessage(`Complete the following text naturally:\n\n${cursorContext.slice(-500)}`),
  ])

  return res.json({ suggestion: result.trim(), usingServerKey })
})
