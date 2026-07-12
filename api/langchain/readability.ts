import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { createChatModel, type Provider } from '../lib/models.js'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools.js'

export default createHandler(async (req, res) => {
  const { content, provider = 'openai', userApiKey } = req.body || {}
  if (!content || content.length < 20) return res.json({ enhanced: '', usingServerKey: false })

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) return errorResponse(res, 500, `${provider} API key not configured`)

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.3, maxTokens: 2000 })
  const parser = new StringOutputParser()

  const result = await model.pipe(parser).invoke([
    new SystemMessage(
      `You are a readability enhancement assistant for a memo app. Reformat the given memo content to improve readability using Markdown formatting. Rules:
- Use headings (##, ###) to organize sections
- Use bullet points or numbered lists where appropriate
- Use **bold** for key terms or important points
- Add proper paragraph spacing
- Do NOT add, remove, or change any information — only restructure and format
- Write in the same language as the input
- Return ONLY the reformatted content, no explanations`
    ),
    new HumanMessage(content.slice(0, 5000)),
  ])

  return res.json({ enhanced: result.trim(), usingServerKey })
})
