import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { OpenAIEmbeddings } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

// ─── Model Configuration ────────────────────────────
const MODELS = {
  openai: 'gpt-4.1-nano',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-2.5-flash',
} as const

export type Provider = 'openai' | 'anthropic' | 'gemini'

interface ChatModelOptions {
  temperature?: number
  maxTokens?: number
}

// ─── Chat Model Factory ─────────────────────────────

export function createChatModel(
  provider: Provider,
  apiKey: string,
  options: ChatModelOptions = {}
): BaseChatModel {
  const { temperature = 0.3, maxTokens = 500 } = options

  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({
        model: MODELS.anthropic,
        anthropicApiKey: apiKey,
        maxTokens,
        temperature,
      })

    case 'gemini':
      return new ChatGoogleGenerativeAI({
        model: MODELS.gemini,
        apiKey,
        maxOutputTokens: maxTokens * 4, // Gemini thinking tokens
        temperature,
      })

    case 'openai':
    default:
      return new ChatOpenAI({
        model: MODELS.openai,
        openAIApiKey: apiKey,
        maxTokens,
        temperature,
      })
  }
}

// ─── Embedding Model Factory ────────────────────────

export function createEmbeddingModel(apiKey: string): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    openAIApiKey: apiKey,
  })
}
