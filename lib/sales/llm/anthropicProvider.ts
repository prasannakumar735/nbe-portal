import type { LLMProvider } from '@/lib/sales/llm/llmProvider.interface'

export const anthropicProvider: LLMProvider = {
  async generateEmail(_prompt: string, _options?: { systemPrompt?: string }) {
    throw new Error('Anthropic provider not implemented yet')
  },
}
