import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createChatModel, type Provider } from '../lib/models.js'
import { resolveApiKey } from '../lib/tools.js'
import { ensureTracing } from '../lib/tracing.js'
import { applyCors } from '../lib/cors.js'

const PROMPTS: Record<string, string> = {
  readability: `You are a readability enhancement assistant for a memo app. Reformat the given memo content to improve readability using Markdown formatting. Rules:
- Use headings (##, ###) to organize sections
- Use bullet points or numbered lists where appropriate
- Use **bold** for key terms or important points
- Add proper paragraph spacing
- Do NOT add, remove, or change any information — only restructure and format
- Write in the same language as the input
- Return ONLY the reformatted content, no explanations`,
  summary: `You are a summarization assistant for a Korean memo app. Summarize the given memo content in 2-3 concise sentences in Korean. Focus on the key points and main ideas. Return only the summary text.`,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  ensureTracing()

  const { content, task = 'readability', provider = 'openai', userApiKey } = req.body || {}
  if (!content) return res.status(400).json({ error: 'Missing content' })

  const systemPrompt = PROMPTS[task]
  if (!systemPrompt) return res.status(400).json({ error: `Unknown task: ${task}` })

  const apiKey = resolveApiKey(provider as Provider, userApiKey)
  if (!apiKey) return res.status(500).json({ error: `${provider} API key not configured` })

  const maxTokens = task === 'readability' ? 2000 : 500
  const model = createChatModel(provider as Provider, apiKey, { temperature: 0.3, maxTokens })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  try {
    const stream = await model.stream([
      new SystemMessage(systemPrompt),
      new HumanMessage(content.slice(0, 5000)),
    ])

    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string' ? chunk.content : ''
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    }
    res.write(`data: ${JSON.stringify({ usingServerKey: !userApiKey })}\n\n`)
    res.write('data: [DONE]\n\n')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream error'
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
  }

  res.end()
}
