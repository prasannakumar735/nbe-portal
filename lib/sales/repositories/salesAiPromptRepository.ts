import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesAiPrompt,
  SalesAiPromptInsert,
} from '@/lib/sales/types/aiPrompt.types'
import {
  buildPromptNameKey,
  parseSalesAiPromptDefinitionFromDb,
} from '@/lib/sales/types/aiPrompt.types'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { isSalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import { isSalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import { isSalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { validateSalesAiPromptForActivation } from '@/lib/sales/prompts/promptValidation'

const TABLE = 'sales_ai_prompts'

export class SalesAiPromptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesAiPromptError'
  }
}

function mapRow(row: Record<string, unknown>): SalesAiPrompt {
  const product = String(row.product_slug ?? '')
  const industry = String(row.industry_slug ?? 'general')
  const useCase = String(row.use_case_slug ?? 'initial_outreach')
  if (!isSalesProductLineSlug(product) || !isSalesIndustrySlug(industry) || !isSalesPromptUseCaseSlug(useCase)) {
    throw new SalesAiPromptError('Invalid prompt library row (slug enums).')
  }
  return {
    id: String(row.id),
    prompt_name: String(row.prompt_name),
    version: Number(row.version ?? 1),
    product_slug: product,
    industry_slug: industry,
    use_case_slug: useCase,
    campaign_type_id: row.campaign_type_id != null ? String(row.campaign_type_id) : null,
    definition: parseSalesAiPromptDefinitionFromDb(row.definition),
    description: row.description != null ? String(row.description).trim() || null : null,
    is_active: Boolean(row.is_active),
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
  }
}

export type SalesAiPromptListOptions = {
  productSlug?: SalesProductLineSlug
  industrySlug?: SalesIndustrySlug
  useCaseSlug?: SalesPromptUseCaseSlug
  campaignTypeId?: string
  activeOnly?: boolean
  promptName?: string
  limit?: number
}

export async function listSalesAiPrompts(
  supabase: SupabaseClient,
  options?: SalesAiPromptListOptions,
): Promise<SalesAiPrompt[]> {
  let query = supabase.from(TABLE).select('*').order('version', { ascending: false })

  if (options?.productSlug) query = query.eq('product_slug', options.productSlug)
  if (options?.industrySlug) query = query.eq('industry_slug', options.industrySlug)
  if (options?.useCaseSlug) query = query.eq('use_case_slug', options.useCaseSlug)
  if (options?.campaignTypeId) query = query.eq('campaign_type_id', options.campaignTypeId)
  if (options?.activeOnly) query = query.eq('is_active', true)
  if (options?.promptName) query = query.eq('prompt_name', options.promptName)
  if (options?.limit != null) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesAiPromptById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesAiPrompt | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getActiveSalesAiPrompt(
  supabase: SupabaseClient,
  slot: {
    productSlug: SalesProductLineSlug
    industrySlug: SalesIndustrySlug
    useCaseSlug: SalesPromptUseCaseSlug
  },
): Promise<SalesAiPrompt | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('product_slug', slot.productSlug)
    .eq('industry_slug', slot.industrySlug)
    .eq('use_case_slug', slot.useCaseSlug)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getNextSalesAiPromptVersion(
  supabase: SupabaseClient,
  promptName: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('version')
    .eq('prompt_name', promptName)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? Number(data.version) + 1 : 1
}

export async function createSalesAiPrompt(
  supabase: SupabaseClient,
  row: SalesAiPromptInsert,
): Promise<SalesAiPrompt> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      prompt_name: row.prompt_name,
      version: row.version,
      product_slug: row.product_slug,
      industry_slug: row.industry_slug,
      use_case_slug: row.use_case_slug,
      campaign_type_id: row.campaign_type_id ?? null,
      definition: row.definition,
      description: row.description ?? null,
      is_active: row.is_active ?? false,
      created_by: row.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesAiPromptDefinition(
  supabase: SupabaseClient,
  id: string,
  definition: SalesAiPromptInsert['definition'],
): Promise<SalesAiPrompt> {
  return updateSalesAiPrompt(supabase, id, { definition })
}

/** Update inactive prompt definition and/or description. Active rows are immutable. */
export async function updateSalesAiPrompt(
  supabase: SupabaseClient,
  id: string,
  patch: {
    definition?: SalesAiPromptInsert['definition']
    description?: string | null
  },
): Promise<SalesAiPrompt> {
  const existing = await getSalesAiPromptById(supabase, id)
  if (!existing) throw new SalesAiPromptError('Prompt not found.')
  if (existing.is_active) {
    throw new SalesAiPromptError('Active prompts are immutable; publish a new version instead.')
  }

  const update: Record<string, unknown> = {}
  if (patch.definition != null) update.definition = patch.definition
  if (patch.description !== undefined) update.description = patch.description

  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq('id', id)
    .eq('is_active', false)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SalesAiPromptError('Prompt could not be updated.')
  return mapRow(data as Record<string, unknown>)
}

export class SalesAiPromptActivationConflictError extends SalesAiPromptError {
  readonly code = 'ACTIVE_PROMPT_EXISTS' as const
  readonly currentActive: SalesAiPrompt

  constructor(currentActive: SalesAiPrompt) {
    super(
      'Another prompt is already active for this Product + Industry + Use Case. Confirm replacement to continue.',
    )
    this.name = 'SalesAiPromptActivationConflictError'
    this.currentActive = currentActive
  }
}

export class SalesAiPromptValidationError extends SalesAiPromptError {
  readonly code = 'VALIDATION_FAILED' as const
  readonly errors: string[]

  constructor(errors: string[]) {
    super(`Prompt is incomplete and cannot be activated:\n- ${errors.join('\n- ')}`)
    this.name = 'SalesAiPromptValidationError'
    this.errors = errors
  }
}

export async function activateSalesAiPrompt(
  supabase: SupabaseClient,
  id: string,
  options?: { confirmReplace?: boolean },
): Promise<SalesAiPrompt> {
  const target = await getSalesAiPromptById(supabase, id)
  if (!target) throw new SalesAiPromptError('Prompt not found.')
  if (target.is_active) return target

  const validation = validateSalesAiPromptForActivation(target.definition)
  if (!validation.ok) {
    throw new SalesAiPromptValidationError(validation.errors)
  }

  const currentActive = await getActiveSalesAiPrompt(supabase, {
    productSlug: target.product_slug,
    industrySlug: target.industry_slug,
    useCaseSlug: target.use_case_slug,
  })

  if (currentActive && currentActive.id !== id) {
    if (!options?.confirmReplace) {
      throw new SalesAiPromptActivationConflictError(currentActive)
    }
  }

  if (currentActive && currentActive.id !== id) {
    const { error: deactivateError } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq('id', currentActive.id)
    if (deactivateError) throw deactivateError
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active: true })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SalesAiPromptError('Prompt could not be activated.')
  return mapRow(data as Record<string, unknown>)
}

/** Clear active flag for this row only (slot may have no active prompt). */
export async function deactivateSalesAiPrompt(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesAiPrompt> {
  const target = await getSalesAiPromptById(supabase, id)
  if (!target) throw new SalesAiPromptError('Prompt not found.')
  if (!target.is_active) return target

  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active: false })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SalesAiPromptError('Prompt could not be deactivated.')
  return mapRow(data as Record<string, unknown>)
}

export function buildSalesAiPromptInsert(input: {
  product_slug: SalesProductLineSlug
  industry_slug: SalesIndustrySlug
  use_case_slug: SalesPromptUseCaseSlug
  campaign_type_id?: string | null
  definition: SalesAiPromptInsert['definition']
  description?: string | null
  version: number
  created_by?: string | null
  activate?: boolean
}): SalesAiPromptInsert {
  return {
    prompt_name: buildPromptNameKey({
      product_slug: input.product_slug,
      industry_slug: input.industry_slug,
      use_case_slug: input.use_case_slug,
    }),
    version: input.version,
    product_slug: input.product_slug,
    industry_slug: input.industry_slug,
    use_case_slug: input.use_case_slug,
    campaign_type_id: input.campaign_type_id ?? null,
    definition: input.definition,
    description: input.description ?? null,
    is_active: input.activate ?? false,
    created_by: input.created_by ?? null,
  }
}
