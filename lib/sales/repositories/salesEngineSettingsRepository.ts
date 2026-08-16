import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesEngineSettingRow } from '@/lib/sales/types/salesEngineSettings.types'

const SETTINGS_TABLE = 'sales_engine_settings'
const AUDIT_TABLE = 'sales_engine_settings_audit'

function mapSettingRow(row: Record<string, unknown>): SalesEngineSettingRow {
  return {
    key: String(row.key),
    value: row.value,
    updated_at: String(row.updated_at),
    updated_by: row.updated_by != null ? String(row.updated_by) : null,
  }
}

export async function listSalesEngineSettings(
  supabase: SupabaseClient,
): Promise<SalesEngineSettingRow[]> {
  const { data, error } = await supabase.from(SETTINGS_TABLE).select('*').order('key')
  if (error) throw error
  return (data ?? []).map((row) => mapSettingRow(row as Record<string, unknown>))
}

export async function getSalesEngineSetting(
  supabase: SupabaseClient,
  key: string,
): Promise<SalesEngineSettingRow | null> {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('*')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapSettingRow(data as Record<string, unknown>)
}

export type SalesEngineSettingUpsertPatch = {
  key: string
  value: unknown
}

export async function upsertSalesEngineSettings(
  supabase: SupabaseClient,
  patches: SalesEngineSettingUpsertPatch[],
  updatedBy: string | null,
): Promise<SalesEngineSettingRow[]> {
  if (patches.length === 0) return []

  const keys = patches.map((p) => p.key)
  const { data: existingRows, error: readErr } = await supabase
    .from(SETTINGS_TABLE)
    .select('key, value')
    .in('key', keys)
  if (readErr) throw readErr

  const existingByKey = new Map(
    (existingRows ?? []).map((r) => [String((r as { key: string }).key), (r as { value: unknown }).value]),
  )

  const now = new Date().toISOString()
  const upsertPayload = patches.map((p) => ({
    key: p.key,
    value: p.value,
    updated_at: now,
    updated_by: updatedBy,
  }))

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(upsertPayload, { onConflict: 'key' })
    .select('*')
  if (error) throw error

  const auditRows = patches.map((p) => ({
    key: p.key,
    old_value: existingByKey.has(p.key) ? existingByKey.get(p.key) : null,
    new_value: p.value,
    changed_by: updatedBy,
  }))

  const { error: auditErr } = await supabase.from(AUDIT_TABLE).insert(auditRows)
  if (auditErr) throw auditErr

  return (data ?? []).map((row) => mapSettingRow(row as Record<string, unknown>))
}
