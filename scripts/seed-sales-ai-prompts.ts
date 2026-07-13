/**
 * Seeds Phase 8.7 Prompt Library content (product × industry × initial_outreach).
 * Run: npx tsx --env-file=.env.local scripts/seed-sales-ai-prompts.ts
 *
 * Inserts version 2 rows when missing; deactivates prior active versions in the same slot.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { buildPromptNameKey } from '../lib/sales/types/aiPrompt.types'
import { formatPromptDescriptionLabel } from '../lib/sales/prompts/promptLabels'
import { validateSalesAiPromptSeedContent } from '../lib/sales/prompts/seed/promptSeedContentValidation'
import {
  SALES_AI_PROMPT_SEED_CATALOG,
  SALES_AI_PROMPT_SEED_VERSION,
} from '../lib/sales/prompts/seed/salesAiPromptSeedCatalog'

config({ path: resolve(process.cwd(), '.env.local') })

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

  for (const slot of SALES_AI_PROMPT_SEED_CATALOG) {
    const description = formatPromptDescriptionLabel({
      productSlug: slot.product_slug,
      industrySlug: slot.industry_slug,
      useCaseSlug: slot.use_case_slug,
    })
    const promptName = buildPromptNameKey({
      product_slug: slot.product_slug,
      industry_slug: slot.industry_slug,
      use_case_slug: slot.use_case_slug,
    })

    const contentCheck = validateSalesAiPromptSeedContent(slot.definition)
    if (!contentCheck.ok) {
      throw new Error(`${description}: ${contentCheck.errors.join('; ')}`)
    }

    const { data: existingV } = await supabase
      .from('sales_ai_prompts')
      .select('id')
      .eq('prompt_name', promptName)
      .eq('version', SALES_AI_PROMPT_SEED_VERSION)
      .maybeSingle()

    if (existingV) {
      console.info('Skip existing', description, `v${SALES_AI_PROMPT_SEED_VERSION}`)
      continue
    }

    const { data: activeRows, error: activeErr } = await supabase
      .from('sales_ai_prompts')
      .select('id, version')
      .eq('product_slug', slot.product_slug)
      .eq('industry_slug', slot.industry_slug)
      .eq('use_case_slug', slot.use_case_slug)
      .eq('is_active', true)

    if (activeErr) throw activeErr

    if (activeRows?.length) {
      const { error: deactivateErr } = await supabase
        .from('sales_ai_prompts')
        .update({ is_active: false })
        .in(
          'id',
          activeRows.map((r) => r.id),
        )
      if (deactivateErr) throw deactivateErr
    }

    const { error: insertErr } = await supabase.from('sales_ai_prompts').insert({
      prompt_name: promptName,
      version: SALES_AI_PROMPT_SEED_VERSION,
      product_slug: slot.product_slug,
      industry_slug: slot.industry_slug,
      use_case_slug: slot.use_case_slug,
      description,
      definition: slot.definition,
      is_active: true,
    })
    if (insertErr) throw insertErr
    console.info('Seeded', description, `v${SALES_AI_PROMPT_SEED_VERSION}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
