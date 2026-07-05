export interface GeneratedEmailResult {
  subject: string
  body: string
  provider: string
}

export interface LLMProviderGenerateOptions {
  systemPrompt?: string
}

export interface LLMProvider {
  generateEmail(prompt: string, options?: LLMProviderGenerateOptions): Promise<GeneratedEmailResult>
}
