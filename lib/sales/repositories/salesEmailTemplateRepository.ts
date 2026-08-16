import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesEmailTemplate,
  SalesEmailTemplateInsert,
  SalesEmailTemplateUpdate,
} from '@/lib/sales/types/emailTemplate.types'
import { parsePromptConfigFromDb } from '@/lib/sales/types/emailTemplatePromptConfig'

const TABLE = 'sales_email_templates'
const SELECT_WITH_TYPE = '*, sales_campaign_types(name)'

function mapRow(row: Record<string, unknown>): SalesEmailTemplate {
  const joined = row.sales_campaign_types as { name?: string } | null | undefined
  return {
    id: String(row.id),
    campaign_type_id: String(row.campaign_type_id),
    campaign_type_name: joined?.name != null ? String(joined.name) : undefined,
    template_name: String(row.template_name),
    prompt_config: parsePromptConfigFromDb(row.prompt_config),
    version: Number(row.version ?? 1),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  }
}

export async function listSalesEmailTemplates(
  supabase: SupabaseClient,
  options?: { campaignTypeId?: string },
): Promise<SalesEmailTemplate[]> {
  let query = supabase
    .from(TABLE)
    .select(SELECT_WITH_TYPE)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })

  if (options?.campaignTypeId) {
    query = query.eq('campaign_type_id', options.campaignTypeId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesEmailTemplateById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailTemplate | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_WITH_TYPE)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

/** Phase 5: highest-version active template for a campaign type. */
export async function getActiveSalesEmailTemplateByCampaignTypeId(
  supabase: SupabaseClient,
  campaignTypeId: string,
): Promise<SalesEmailTemplate | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_WITH_TYPE)
    .eq('campaign_type_id', campaignTypeId)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createSalesEmailTemplate(
  supabase: SupabaseClient,
  row: SalesEmailTemplateInsert,
): Promise<SalesEmailTemplate> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      campaign_type_id: row.campaign_type_id,
      template_name: row.template_name,
      prompt_config: row.prompt_config,
      version: row.version ?? 1,
      is_active: row.is_active ?? true,
    })
    .select(SELECT_WITH_TYPE)
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesEmailTemplate(
  supabase: SupabaseClient,
  id: string,
  patch: SalesEmailTemplateUpdate,
): Promise<SalesEmailTemplate> {
  const existing = await getSalesEmailTemplateById(supabase, id)
  if (!existing) throw new Error('Email template not found.')

  const payload: Record<string, unknown> = {}
  if (patch.campaign_type_id != null) payload.campaign_type_id = patch.campaign_type_id
  if (patch.template_name != null) payload.template_name = patch.template_name
  if (patch.is_active != null) payload.is_active = patch.is_active

  if (patch.prompt_config != null) {
    payload.prompt_config = patch.prompt_config
    payload.version = patch.version ?? existing.version + 1
  } else if (patch.version != null) {
    payload.version = patch.version
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(SELECT_WITH_TYPE)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Email template not found.')
  return mapRow(data as Record<string, unknown>)
}

export async function setSalesEmailTemplateActive(
  supabase: SupabaseClient,
  id: string,
  isActive: boolean,
): Promise<SalesEmailTemplate> {
  return updateSalesEmailTemplate(supabase, id, { is_active: isActive })
}
