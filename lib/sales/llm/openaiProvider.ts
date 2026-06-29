import type { LLMProvider } from '@/lib/sales/llm/llmProvider.interface'

export const openaiProvider: LLMProvider = {
  async generateEmail(_prompt: string) {
    throw new Error('OpenAI provider not implemented yet')
  },
}
