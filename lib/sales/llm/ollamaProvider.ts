import type { LLMProvider } from '@/lib/sales/llm/llmProvider.interface'

export const ollamaProvider: LLMProvider = {
  async generateEmail(_prompt: string) {
    throw new Error('Ollama provider not implemented yet')
  },
}
