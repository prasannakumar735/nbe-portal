/** Shared system instruction for sales email LLM providers (JSON subject/body). */
import { formatNbeFrameworkSystemBrief } from '@/lib/sales/prompts/globalWritingRules'
import { SALES_AI_DEFAULT_OUTPUT_FORMAT } from '@/lib/sales/prompts/globalWritingRules'

export const SALES_EMAIL_GENERATION_SYSTEM_PROMPT = [
  formatNbeFrameworkSystemBrief(),
  SALES_AI_DEFAULT_OUTPUT_FORMAT,
].join('\n\n')
