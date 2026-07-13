import type { SalesAssistantCapability } from '@/lib/sales/constants/assistantCapabilities'
import { SALES_ASSISTANT_DISCLAIMER } from '@/lib/sales/constants/assistantCapabilities'
import {
  SALES_PRODUCT_LINE_LABELS,
  SALES_PRODUCT_LINE_SLUGS,
} from '@/lib/sales/constants/productLineSlugs'
import { NBE_BANNED_PHRASES } from '@/lib/sales/prompts/nbeB2bSalesEmailFramework'
import { formatAssistantContextBlock } from '@/lib/sales/assistant/salesAssistantContext'
import type { SalesAssistantContextSnapshot } from '@/lib/sales/types/salesAssistant.types'

const JSON_SHAPE = `{
  "title": string,
  "summary": string,
  "sections": [{"heading": string, "body": string}],
  "bulletActions": string[],
  "recommendedProducts": [{"slug": string, "label": string, "rationale": string}] (optional),
  "followUpDraft": {
    "suggestedTiming": string,
    "talkingPoints": string[],
    "note": "Talking points only — manager drafts and approves any customer email separately."
  } (optional),
  "inspectionNotes": string (optional),
  "quoteSummary": string (optional)
}`

export function buildSalesAssistantSystemPrompt(): string {
  const products = SALES_PRODUCT_LINE_SLUGS.map(
    (slug) => `- ${slug}: ${SALES_PRODUCT_LINE_LABELS[slug]}`,
  ).join('\n')

  return [
    'You are an internal AI sales assistant for NBE Australia warehouse and industrial door specialists.',
    'Audience: sales managers only. Australian English. Consultative, factual tone.',
    '',
    '## Hard rules',
    '- NEVER draft a complete customer email ready to send automatically.',
    '- NEVER instruct the system or user to send email without manager review.',
    '- Follow-up output must be timing + talking points only (no full email body).',
    '- Do not guarantee ROI, specific savings %, or outcomes not supported by context.',
    '- Avoid banned marketing phrases:',
    ...NBE_BANNED_PHRASES.slice(0, 12).map((p) => `  - "${p}"`),
    '',
    '## NBE product lines (recommend only from this list)',
    products,
    '',
    '## Output',
    'Return a single JSON object matching this shape (no markdown outside JSON):',
    JSON_SHAPE,
    '',
    `Disclaimer to reflect in summary when relevant: ${SALES_ASSISTANT_DISCLAIMER}`,
  ].join('\n')
}

function capabilityInstruction(capability: SalesAssistantCapability): string {
  switch (capability) {
    case 'summarise_replies':
      return 'Summarise the prospect reply: intent, objections, buying signals, risks, and what they are asking for.'
    case 'suggest_next_actions':
      return 'Suggest 3–6 concrete next actions for the manager (CRM updates, calls, inspections, internal handoffs). Prioritise by impact.'
    case 'recommend_products':
      return 'Recommend 1–3 NBE product lines with rationale tied to the business category and context. Include recommendedProducts array.'
    case 'recommend_followups':
      return 'Recommend follow-up approach: timing and talking points only in followUpDraft. Do NOT write a send-ready email.'
    case 'generate_inspection_notes':
      return 'Draft site inspection notes template the manager can use on site (checklist style) in inspectionNotes and sections.'
    case 'prepare_quote_summary':
      return 'Prepare an internal quote summary outline (scope, assumptions, line items to confirm) in quoteSummary and sections — not a customer PDF.'
    default:
      return 'Provide manager-facing sales guidance.'
  }
}

export function buildSalesAssistantUserPrompt(input: {
  capability: SalesAssistantCapability
  context: SalesAssistantContextSnapshot
  replyText?: string | null
  managerNotes?: string | null
}): string {
  const parts = [
    `## Task\n${capabilityInstruction(input.capability)}`,
    '',
    formatAssistantContextBlock(input.context),
  ]

  if (input.replyText?.trim()) {
    parts.push('', '## Prospect reply text (paste)', input.replyText.trim())
  } else if (input.capability === 'summarise_replies') {
    parts.push(
      '',
      '## Prospect reply text',
      '(No reply text provided — summarise based on engagement flags and thread context only, and note missing reply.)',
    )
  }

  if (input.managerNotes?.trim()) {
    parts.push('', '## Manager notes', input.managerNotes.trim())
  }

  parts.push('', 'Respond with JSON only.')
  return parts.join('\n')
}
