import Groq from 'groq-sdk'
import {
  isLLMProviderId,
  resolveDefaultSalesLlmProvider,
  type LLMProviderId,
} from '@/lib/sales/constants/llmProviders'
import { GenerationMalformedResponseError } from '@/lib/sales/generation/generationFailureClassifier'

export type RunChatCompletionInput = {
  provider?: string | null
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
}

export type RunChatCompletionResult = {
  content: string
  provider: LLMProviderId
  latencyMs: number
}

const XAI_CHAT_COMPLETIONS_URL = 'https://api.x.ai/v1/chat/completions'

function resolveProviderId(raw?: string | null): LLMProviderId {
  const trimmed = raw?.trim().toLowerCase()
  if (trimmed && isLLMProviderId(trimmed)) return trimmed
  return resolveDefaultSalesLlmProvider()
}

function parseRetryAfterMs(message: string): number {
  const match = /try again in ([\d.]+)s/i.exec(message)
  return match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 30_000
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runGroqChat(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.')
  const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b'
  const groq = new Groq({ apiKey })
  const maxAttempts = 4
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.35,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
      const content = completion.choices?.[0]?.message?.content?.trim()
      if (!content) throw new GenerationMalformedResponseError('Groq returned an empty completion.')
      return content
    } catch (error) {
      if (error instanceof GenerationMalformedResponseError) throw error
      const message = error instanceof Error ? error.message : String(error)
      const isRateLimit = message.includes('429') || message.toLowerCase().includes('rate limit')
      if (isRateLimit && attempt < maxAttempts - 1) {
        await sleep(parseRetryAfterMs(message))
        continue
      }
      throw new Error(`Groq provider error: ${message}`)
    }
  }
  throw new Error('Groq provider error: max retries exceeded.')
}

async function runXaiChat(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) throw new Error('XAI_API_KEY is not configured.')
  const model = process.env.XAI_MODEL?.trim() || 'grok-2'
  const response = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`xAI chat error (${response.status}): ${rawText.slice(0, 400)}`)
  }
  const payload = JSON.parse(rawText) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) throw new GenerationMalformedResponseError('xAI returned an empty completion.')
  return content
}

/** Text completion for internal assistant (not customer email send). */
export async function runChatCompletion(
  input: RunChatCompletionInput,
): Promise<RunChatCompletionResult> {
  const provider = resolveProviderId(input.provider)
  const maxTokens = input.maxTokens ?? 1800
  const startedAt = Date.now()

  let content: string
  if (provider === 'groq') {
    content = await runGroqChat(input.systemPrompt, input.userPrompt, maxTokens)
  } else if (provider === 'xai') {
    content = await runXaiChat(input.systemPrompt, input.userPrompt, maxTokens)
  } else {
    throw new Error(
      `Sales assistant chat is not configured for provider "${provider}". Set SALES_LLM_PROVIDER to groq or xai.`,
    )
  }

  return {
    content,
    provider,
    latencyMs: Math.max(0, Date.now() - startedAt),
  }
}
