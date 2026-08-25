import { GenerationMalformedResponseError } from '@/lib/sales/generation/generationFailureClassifier'
import { SALES_EMAIL_GENERATION_SYSTEM_PROMPT } from '@/lib/sales/llm/emailGenerationSystemPrompt'
import type { GeneratedEmailResult, LLMProvider } from '@/lib/sales/llm/llmProvider.interface'
import { parseLlmEmailResponse } from '@/lib/sales/llm/parseLlmEmailResponse'

const XAI_CHAT_COMPLETIONS_URL = 'https://api.x.ai/v1/chat/completions'
const DEFAULT_XAI_MODEL = 'grok-2'

type XaiChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null }
  }>
  error?: { message?: string }
}

function resolveXaiModel(): string {
  const fromEnv = process.env.XAI_MODEL?.trim()
  return fromEnv || DEFAULT_XAI_MODEL
}

function requireXaiApiKey(): string {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not configured. Add it to .env.local for local dev.')
  }
  return apiKey
}

export const xaiProvider: LLMProvider = {
  async generateEmail(prompt: string, options?: { systemPrompt?: string }): Promise<GeneratedEmailResult> {
    const systemContent = options?.systemPrompt?.trim() || SALES_EMAIL_GENERATION_SYSTEM_PROMPT
    let response: Response
    try {
      response = await fetch(XAI_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${requireXaiApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolveXaiModel(),
          temperature: 0.4,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: prompt },
          ],
        }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`xAI provider error: ${message}`)
    }

    const rawText = await response.text()
    let payload: XaiChatCompletionResponse
    try {
      payload = JSON.parse(rawText) as XaiChatCompletionResponse
    } catch {
      throw new Error(
        `xAI provider error: invalid response (${response.status}): ${rawText.slice(0, 200)}`,
      )
    }

    if (!response.ok) {
      const apiMessage = payload.error?.message?.trim() || rawText.slice(0, 500)
      throw new Error(`xAI provider error: ${response.status} ${apiMessage}`)
    }

    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new GenerationMalformedResponseError('xAI returned an empty completion.')
    }

    const parsed = parseLlmEmailResponse(content)
    return {
      subject: parsed.subject,
      body: parsed.body,
      provider: 'xai',
    }
  },
}
