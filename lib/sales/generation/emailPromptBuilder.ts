import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'
import type { SalesEmailTemplatePromptConfig } from '@/lib/sales/types/emailTemplatePromptConfig'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import { getSalesOfferTypeById } from '@/lib/sales/repositories/salesOfferTypeRepository'
import { getActiveSalesEmailTemplateByCampaignTypeId } from '@/lib/sales/repositories/salesEmailTemplateRepository'

export type EmailGenerationPromptContext = {
  campaign: SalesCampaign
  contact: SalesContact
  business: SalesBusiness
  campaignTypeName: string
  offerTypeName: string
  template: SalesEmailTemplate
  promptConfig: SalesEmailTemplatePromptConfig
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- (none specified)'
}

function buildPersonalizationBlock(contact: SalesContact, business: SalesBusiness): string {
  const lines = [
    `Company: ${business.company_name}`,
    `Location: ${[business.suburb, business.postcode].filter(Boolean).join(', ') || business.postcode}`,
    `Industry/category: ${business.category ?? 'unknown'}`,
    `Website: ${business.website ?? 'unknown'}`,
    `Contact email: ${contact.email ?? 'unknown'}`,
    `Contact type: ${contact.contact_type}`,
    `Primary contact: ${contact.is_primary ? 'yes' : 'no'}`,
  ]
  return lines.join('\n')
}

function assemblePromptText(ctx: EmailGenerationPromptContext): string {
  const { campaign, promptConfig, template } = ctx
  return [
    'You are writing a single personalized B2B sales outreach email.',
    '',
    '## Campaign',
    `Name: ${campaign.name}`,
    `Product/service focus: ${ctx.campaignTypeName}`,
    `Offer: ${ctx.offerTypeName}`,
    '',
    '## Template',
    `Template name: ${template.template_name}`,
    `Objective: ${promptConfig.objective}`,
    `Tone: ${promptConfig.tone}`,
    `Call to action: ${promptConfig.cta}`,
    '',
    '## Pain points to address',
    formatList(promptConfig.pain_points),
    '',
    '## Target roles',
    formatList(promptConfig.target_roles),
    '',
    '## Avoid',
    formatList(promptConfig.avoid),
    '',
    '## Recipient / company context',
    buildPersonalizationBlock(ctx.contact, ctx.business),
    '',
    '## Output format',
    'Return a concise subject line and email body suitable for a warehouse/industrial decision-maker.',
    'Do not use spammy urgency language.',
  ].join('\n')
}

export async function loadEmailGenerationPromptContext(
  supabase: SupabaseClient,
  input: {
    campaign: SalesCampaign
    contact: SalesContact
    business: SalesBusiness
  },
): Promise<EmailGenerationPromptContext> {
  const [campaignType, offerType, template] = await Promise.all([
    getSalesCampaignTypeById(supabase, input.campaign.campaign_type_id),
    getSalesOfferTypeById(supabase, input.campaign.offer_type_id),
    getActiveSalesEmailTemplateByCampaignTypeId(supabase, input.campaign.campaign_type_id),
  ])

  if (!template) {
    throw new Error('No active email template found for campaign type.')
  }

  return {
    campaign: input.campaign,
    contact: input.contact,
    business: input.business,
    campaignTypeName: campaignType?.name ?? 'Unknown campaign type',
    offerTypeName: offerType?.name ?? 'Unknown offer',
    template,
    promptConfig: template.prompt_config,
  }
}

/** Build final LLM prompt from template prompt_config and campaign/contact context. */
export async function buildEmailGenerationPrompt(
  supabase: SupabaseClient,
  input: {
    campaign: SalesCampaign
    contact: SalesContact
    business: SalesBusiness
  },
): Promise<string> {
  const ctx = await loadEmailGenerationPromptContext(supabase, input)
  return assemblePromptText(ctx)
}
