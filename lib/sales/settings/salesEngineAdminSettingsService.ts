import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SALES_ENGINE_SETTING_DEFINITIONS,
  getDefaultSalesEngineSettingValues,
} from '@/lib/sales/settings/salesEngineSettingDefinitions'
import {
  buildSalesEngineSettingsSnapshot,
  invalidateSalesEngineSettingsCache,
  loadSalesEngineSettings,
} from '@/lib/sales/settings/salesEngineSettingsService'
import {
  listSalesEngineSettings,
  upsertSalesEngineSettings,
} from '@/lib/sales/repositories/salesEngineSettingsRepository'
import type { SalesEngineSettingDefinition } from '@/lib/sales/types/salesEngineSettings.types'

export type SalesEngineAdminSettingsResponse = {
  definitions: SalesEngineSettingDefinition[]
  values: Record<string, unknown>
  snapshot: ReturnType<typeof buildSalesEngineSettingsSnapshot>
}

export async function getSalesEngineAdminSettingsPayload(
  supabase: SupabaseClient,
): Promise<SalesEngineAdminSettingsResponse> {
  const rows = await listSalesEngineSettings(supabase)
  const values = { ...getDefaultSalesEngineSettingValues() }
  for (const row of rows) {
    values[row.key] = row.value
  }
  const snapshot = buildSalesEngineSettingsSnapshot(values)
  return {
    definitions: [...SALES_ENGINE_SETTING_DEFINITIONS],
    values,
    snapshot,
  }
}

export async function applySalesEngineSettingsPatch(
  supabase: SupabaseClient,
  patches: { key: string; value: unknown }[],
  updatedBy: string,
): Promise<SalesEngineAdminSettingsResponse> {
  await upsertSalesEngineSettings(
    supabase,
    patches.map((p) => ({ key: p.key, value: p.value })),
    updatedBy,
  )
  invalidateSalesEngineSettingsCache()
  return getSalesEngineAdminSettingsPayload(supabase)
}
