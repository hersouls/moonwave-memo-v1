import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, type Provider } from '../lib/models.js'
import { resolveApiKey, createHandler, errorResponse } from '../lib/tools.js'
import { applyCors } from '../lib/cors.js'

export default createHandler(async (req, res) => {
  if (applyCors(req, res)) return
  const { content, folderNames = [], provider = 'openai', userApiKey } = req.body || {}
  if (!content || content.length < 5) {
    return res.json({ folder: null, tags: [], title: '', usingServerKey: false })
  }

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) return errorResponse(res, 500, `${provider} API key not configured`)

  const usingServerKey = !userApiKey
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.3, maxTokens: 300 })

  const response = await model.invoke([
    new SystemMessage(
      `You are a memo classification assistant for a Korean memo app. Given the user's raw text and the available folder list, classify it automatically.

Available folders: ${JSON.stringify(folderNames)}

Return ONLY valid JSON in this exact format:
{"folder": "folder name or null", "tags": ["tag1", "tag2"], "title": "short title"}

Rules:
- folder must be one of the available folders or null if none fits
- tags should be 1-3 relevant Korean tags without # prefix
- title should be a concise Korean title (under 30 chars)
- Do not add any text outside the JSON`
    ),
    new HumanMessage(content.slice(0, 1000)),
  ])

  const text = typeof response.content === 'string' ? response.content : ''
  let folder: string | null = null
  let tags: string[] = []
  let title = ''

  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      folder = typeof parsed.folder === 'string' && folderNames.includes(parsed.folder) ? parsed.folder : null
      tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 5) : []
      title = typeof parsed.title === 'string' ? parsed.title : ''
    }
  } catch { /* fallback to defaults */ }

  return res.json({ folder, tags, title, usingServerKey })
})
