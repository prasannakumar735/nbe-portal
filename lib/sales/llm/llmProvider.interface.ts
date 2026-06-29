export interface GeneratedEmailResult {
  subject: string
  body: string
  provider: string
}

export interface LLMProvider {
  generateEmail(prompt: string): Promise<GeneratedEmailResult>
}
