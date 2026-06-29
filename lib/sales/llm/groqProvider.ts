import type { LLMProvider } from '@/lib/sales/llm/llmProvider.interface'

export const groqProvider: LLMProvider = {
  async generateEmail(_prompt: string) {
    throw new Error('Groq provider not implemented yet')
  },
}
