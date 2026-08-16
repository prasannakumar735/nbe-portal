import Groq from 'groq-sdk'
import { GenerationMalformedResponseError } from '@/lib/sales/generation/generationFailureClassifier'
import type { GeneratedEmailResult, LLMProvider } from '@/lib/sales/llm/llmProvider.interface'
import { SALES_EMAIL_GENERATION_SYSTEM_PROMPT } from '@/lib/sales/llm/emailGenerationSystemPrompt'
import { parseLlmEmailResponse } from '@/lib/sales/llm/parseLlmEmailResponse'

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

function resolveGroqModel(): string {
  const fromEnv = process.env.GROQ_MODEL?.trim()
  return fromEnv || DEFAULT_GROQ_MODEL
}

function requireGroqApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured. Add it to .env.local for local dev.')
  }
  return apiKey
}

export const groqProvider: LLMProvider = {
  async generateEmail(prompt: string, options?: { systemPrompt?: string }): Promise<GeneratedEmailResult> {
    const systemContent = options?.systemPrompt?.trim() || SALES_EMAIL_GENERATION_SYSTEM_PROMPT
    const groq = new Groq({ apiKey: requireGroqApiKey() })

    let completion
    try {
      completion = await groq.chat.completions.create({
        model: resolveGroqModel(),
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Groq provider error: ${message}`)
    }

    const content = completion.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new GenerationMalformedResponseError('Groq returned an empty completion.')
    }

    const parsed = parseLlmEmailResponse(content)
    return {
      subject: parsed.subject,
      body: parsed.body,
      provider: 'groq',
    }
  },
}
