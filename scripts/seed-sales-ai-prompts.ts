/**
 * Seeds default Prompt Library rows (product × general × initial_outreach).
 * Run: npx tsx scripts/seed-sales-ai-prompts.ts
 */
import { createClient } from '@supabase/supabase-js'
import { SALES_PRODUCT_LINE_SLUGS, SALES_PRODUCT_LINE_LABELS } from '../lib/sales/constants/productLineSlugs'
import { EMPTY_SALES_AI_PROMPT_DEFINITION, buildPromptNameKey } from '../lib/sales/types/aiPrompt.types'
import { formatPromptDescriptionLabel } from '../lib/sales/prompts/promptLabels'

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

async function main() {
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  for (const productSlug of SALES_PRODUCT_LINE_SLUGS) {
    const label = SALES_PRODUCT_LINE_LABELS[productSlug]
    const industrySlug = 'general' as const
    const useCaseSlug = 'initial_outreach' as const
    const promptName = buildPromptNameKey({
      product_slug: productSlug,
      industry_slug: industrySlug,
      use_case_slug: useCaseSlug,
    })
    const description = formatPromptDescriptionLabel({
      productSlug,
      industrySlug,
      useCaseSlug,
    })

    const { data: existing } = await supabase
      .from('sales_ai_prompts')
      .select('id')
      .eq('prompt_name', promptName)
      .eq('version', 1)
      .maybeSingle()

    if (existing) {
      console.info('Skip existing', description)
      continue
    }

    const definition = {
      ...EMPTY_SALES_AI_PROMPT_DEFINITION,
      writing_style: 'consultative',
      tone: 'professional',
      target_audience: ['Operations manager', 'Warehouse manager', 'Facilities manager'],
      business_pain_points: [
        `Energy loss and contamination risk at ${label} installations`,
        'Downtime from damaged or poorly fitted equipment',
        'Safety and compliance pressure in industrial sites',
      ],
      value_proposition: `NBE Australia helps ${label} customers improve efficiency, compliance, and total cost of ownership with practical, site-focused industrial door solutions.`,
      cta: "If you'd like, we would be happy to arrange a no-obligation site assessment, provide a product recommendation, or prepare a quotation based on your facility's operational requirements.",
      subject_line_guidance:
        'Specific, professional, max 8 words; reference operations or doorway efficiency; no hype or capitals.',
      word_limit: 180,
    }

    const { error } = await supabase.from('sales_ai_prompts').insert({
      prompt_name: promptName,
      version: 1,
      product_slug: productSlug,
      industry_slug: industrySlug,
      use_case_slug: useCaseSlug,
      description,
      definition,
      is_active: true,
    })
    if (error) throw error
    console.info('Seeded', description)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
