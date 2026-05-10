import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Optional server env overrides when `office_clock_sites` rows have NULL FKs
 * (typical right after migration before SQL is run in Supabase).
 *
 * Set in `.env.local` (UUIDs are references only):
 * - OFFICE_CLOCK_CLIENT_ID
 * - OFFICE_CLOCK_LOCATION_ID
 * - OFFICE_CLOCK_WORK_TYPE_LEVEL1_ID
 * - OFFICE_CLOCK_WORK_TYPE_LEVEL2_ID
 * - OFFICE_CLOCK_TECHNICIAN_DEFAULT_WORK_TYPE_LEVEL2_ID (FAB L2 UUID when body omits task)
 *
 * In `NODE_ENV === development`, if still incomplete, the server can auto-pick
 * the first client / location / work types from the DB (unless
 * OFFICE_CLOCK_DISABLE_DEV_AUTOFILL=1).
 */
function envTrim(key: string): string | null {
  const v = process.env[key]?.trim()
  return v || null
}

export function mergeOfficeSiteRowWithEnv(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    client_id: row.client_id ?? envTrim('OFFICE_CLOCK_CLIENT_ID'),
    location_id: row.location_id ?? envTrim('OFFICE_CLOCK_LOCATION_ID'),
    work_type_level1_id: row.work_type_level1_id ?? envTrim('OFFICE_CLOCK_WORK_TYPE_LEVEL1_ID'),
    work_type_level2_id: row.work_type_level2_id ?? envTrim('OFFICE_CLOCK_WORK_TYPE_LEVEL2_ID'),
    technician_default_work_type_level2_id:
      row.technician_default_work_type_level2_id ?? envTrim('OFFICE_CLOCK_TECHNICIAN_DEFAULT_WORK_TYPE_LEVEL2_ID'),
  }
}

/** True when this row (after env merge / dev fill) has all four FKs. */
export function isOfficeSiteRowConfigured(row: Record<string, unknown>): boolean {
  return Boolean(
    row.client_id && row.location_id && row.work_type_level1_id && row.work_type_level2_id,
  )
}

/**
 * Env merge, then in development optionally fill missing FKs from first matching DB rows.
 */
export async function resolveOfficeSiteRowFully(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let m = mergeOfficeSiteRowWithEnv(row)
  if (isOfficeSiteRowConfigured(m)) return m

  if (process.env.NODE_ENV !== 'development' || process.env.OFFICE_CLOCK_DISABLE_DEV_AUTOFILL === '1') {
    return m
  }

  try {
    const { data: client } = await supabase.from('clients').select('id').limit(1).maybeSingle()
    const cid = client?.id != null ? String(client.id) : null
    if (!cid) return m

    const { data: loc } = await supabase
      .from('client_locations')
      .select('id')
      .eq('client_id', cid)
      .limit(1)
      .maybeSingle()
    const lid = loc?.id != null ? String(loc.id) : null

    const { data: l1 } = await supabase
      .from('work_type_level1')
      .select('id')
      .order('code', { ascending: true })
      .limit(1)
      .maybeSingle()
    const l1id = l1?.id != null ? String(l1.id) : null
    if (!l1id) return m

    const { data: l2 } = await supabase
      .from('work_type_level2')
      .select('id')
      .eq('level1_id', l1id)
      .limit(1)
      .maybeSingle()
    const l2id = l2?.id != null ? String(l2.id) : null

    let techFabL2: string | null = null
    if (!m.technician_default_work_type_level2_id) {
      const { data: fabL1 } = await supabase.from('work_type_level1').select('id').ilike('code', 'fab').limit(1).maybeSingle()
      const fabL1id = fabL1?.id != null ? String(fabL1.id) : null
      if (fabL1id) {
        const { data: fabL2 } = await supabase
          .from('work_type_level2')
          .select('id')
          .eq('level1_id', fabL1id)
          .order('name', { ascending: true })
          .limit(1)
          .maybeSingle()
        techFabL2 = fabL2?.id != null ? String(fabL2.id) : null
      }
    }

    m = {
      ...m,
      client_id: m.client_id ?? cid,
      location_id: m.location_id ?? lid,
      work_type_level1_id: m.work_type_level1_id ?? l1id,
      work_type_level2_id: m.work_type_level2_id ?? l2id,
      technician_default_work_type_level2_id: m.technician_default_work_type_level2_id ?? techFabL2,
    }
  } catch (e) {
    console.warn('[resolveOfficeSiteRowFully] dev autofill skipped:', e)
  }

  return m
}
