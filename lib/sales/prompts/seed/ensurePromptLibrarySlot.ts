import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { formatPromptDescriptionLabel } from '@/lib/sales/prompts/promptLabels'
import {
  SALES_AI_PROMPT_SEED_CATALOG,
  SALES_AI_PROMPT_SEED_VERSION,
} from '@/lib/sales/prompts/seed/salesAiPromptSeedCatalog'
import { validateSalesAiPromptSeedContent } from '@/lib/sales/prompts/seed/promptSeedContentValidation'
import {
  activateSalesAiPrompt,
  createSalesAiPrompt,
  getActiveSalesAiPrompt,
  getSalesAiPromptById,
  listSalesAiPrompts,
} from '@/lib/sales/repositories/salesAiPromptRepository'
import { buildPromptNameKey } from '@/lib/sales/types/aiPrompt.types'
import type { PromptResolutionSlot } from '@/lib/sales/prompts/promptResolver'

/** Idempotently ensure catalog default exists and is active for a library slot. */
export async function ensurePromptLibrarySlotFromSeed(
  supabase: SupabaseClient,
  slot: PromptResolutionSlot,
): Promise<void> {
  const active = await getActiveSalesAiPrompt(supabase, {
    productSlug: slot.productSlug,
    industrySlug: slot.industrySlug,
    useCaseSlug: slot.useCaseSlug,
  })
  if (active) return

  const catalogSlot = SALES_AI_PROMPT_SEED_CATALOG.find(
    (row) =>
      row.product_slug === slot.productSlug &&
      row.industry_slug === slot.industrySlug &&
      row.use_case_slug === slot.useCaseSlug,
  )
  if (!catalogSlot) return

  const contentCheck = validateSalesAiPromptSeedContent(catalogSlot.definition)
  if (!contentCheck.ok) {
    throw new Error(`Prompt seed invalid for slot: ${contentCheck.errors.join('; ')}`)
  }

  const promptName = buildPromptNameKey({
    product_slug: slot.productSlug,
    industry_slug: slot.industrySlug,
    use_case_slug: slot.useCaseSlug,
  })

  const { data: existingVersion } = await supabase
    .from('sales_ai_prompts')
    .select('id, is_active')
    .eq('prompt_name', promptName)
    .eq('version', SALES_AI_PROMPT_SEED_VERSION)
    .maybeSingle()

  if (existingVersion) {
    const row = existingVersion as { id: string; is_active: boolean }
    if (!row.is_active) {
      await activateSalesAiPrompt(supabase, row.id, { confirmReplace: true })
    }
    return
  }

  const activeRows = await listSalesAiPrompts(supabase, {
    productSlug: slot.productSlug,
    industrySlug: slot.industrySlug,
    useCaseSlug: slot.useCaseSlug,
    activeOnly: true,
  })
  for (const row of activeRows) {
    await supabase.from('sales_ai_prompts').update({ is_active: false }).eq('id', row.id)
  }

  const description = formatPromptDescriptionLabel({
    productSlug: slot.productSlug,
    industrySlug: slot.industrySlug,
    useCaseSlug: slot.useCaseSlug,
  })

  const created = await createSalesAiPrompt(supabase, {
    prompt_name: promptName,
    version: SALES_AI_PROMPT_SEED_VERSION,
    product_slug: slot.productSlug as SalesProductLineSlug,
    industry_slug: slot.industrySlug as SalesIndustrySlug,
    use_case_slug: slot.useCaseSlug as SalesPromptUseCaseSlug,
    description,
    definition: catalogSlot.definition,
    is_active: true,
  })

  const verified = await getSalesAiPromptById(supabase, created.id)
  if (!verified?.is_active) {
    await activateSalesAiPrompt(supabase, created.id, { confirmReplace: true })
  }
}

export async function ensurePromptLibrarySlotWithFallbacks(
  supabase: SupabaseClient,
  slot: PromptResolutionSlot,
): Promise<void> {
  const attempts: PromptResolutionSlot[] = [
    slot,
    slot.industrySlug !== 'general'
      ? { ...slot, industrySlug: 'general' as SalesIndustrySlug }
      : null,
  ].filter((s): s is PromptResolutionSlot => s != null)

  for (const attempt of attempts) {
    await ensurePromptLibrarySlotFromSeed(supabase, attempt)
    const active = await getActiveSalesAiPrompt(supabase, {
      productSlug: attempt.productSlug,
      industrySlug: attempt.industrySlug,
      useCaseSlug: attempt.useCaseSlug,
    })
    if (active) return
  }
}
