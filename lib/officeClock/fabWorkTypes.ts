import type { SupabaseClient } from '@supabase/supabase-js'

export type FabTaskOption = { id: string; name: string; level1_id: string }

export type ResolvedFabLine = {
  work_type_level1_id: string
  work_type_level2_id: string
  level1Code: string
  level2Name: string
}

export async function listFabLevel2TasksSorted(supabase: SupabaseClient): Promise<FabTaskOption[]> {
  const { data: l1, error: e1 } = await supabase
    .from('work_type_level1')
    .select('id')
    .ilike('code', 'fab')
    .limit(1)
    .maybeSingle()
  if (e1 || !l1?.id) return []

  const { data: rows, error: e2 } = await supabase
    .from('work_type_level2')
    .select('id, name, level1_id')
    .eq('level1_id', String(l1.id))
    .order('name', { ascending: true })
  if (e2 || !rows?.length) return []

  return rows.map(r => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    level1_id: String(r.level1_id),
  }))
}

/** Returns resolved FAB line, or null if this L2 is not under L1 code FAB. */
export async function fetchFabL2IfValid(
  supabase: SupabaseClient,
  level2Id: string,
): Promise<ResolvedFabLine | null> {
  const id = level2Id.trim()
  if (!id) return null

  const { data: l2, error: e2 } = await supabase
    .from('work_type_level2')
    .select('id, name, level1_id')
    .eq('id', id)
    .maybeSingle()
  if (e2 || !l2?.level1_id) return null

  const { data: l1, error: e1 } = await supabase
    .from('work_type_level1')
    .select('id, code')
    .eq('id', String(l2.level1_id))
    .maybeSingle()
  if (e1 || !l1?.code) return null
  if (String(l1.code).trim().toUpperCase() !== 'FAB') return null

  return {
    work_type_level1_id: String(l1.id),
    work_type_level2_id: String(l2.id),
    level1Code: String(l1.code),
    level2Name: String(l2.name ?? ''),
  }
}

/**
 * Technician office clock: explicit L2 from body (must be FAB) else site/env default (must resolve to FAB).
 * - Body present + invalid → 400
 * - Body absent + no valid default → 503
 */
export async function resolveTechnicianFabLineForOfficeClock(
  supabase: SupabaseClient,
  bodyWorkTypeLevel2Id: string | null | undefined,
  siteTechnicianDefaultL2Id: string | null | undefined,
): Promise<
  | { ok: true; line: ResolvedFabLine }
  | { ok: false; status: 400 | 503; message: string }
> {
  const body = typeof bodyWorkTypeLevel2Id === 'string' ? bodyWorkTypeLevel2Id.trim() : ''
  if (body) {
    const line = await fetchFabL2IfValid(supabase, body)
    if (!line) {
      return { ok: false, status: 400, message: 'Invalid task: choose a fabrication (FAB) task from the list.' }
    }
    return { ok: true, line }
  }

  const def = typeof siteTechnicianDefaultL2Id === 'string' ? siteTechnicianDefaultL2Id.trim() : ''
  if (!def) {
    return {
      ok: false,
      status: 503,
      message:
        'Technician default fabrication task is not configured for this office site. Set office_clock_sites.technician_default_work_type_level2_id or OFFICE_CLOCK_TECHNICIAN_DEFAULT_WORK_TYPE_LEVEL2_ID.',
    }
  }
  const line = await fetchFabL2IfValid(supabase, def)
  if (!line) {
    return {
      ok: false,
      status: 503,
      message:
        'Technician default fabrication task is misconfigured (not a FAB task). Update office_clock_sites.technician_default_work_type_level2_id or env OFFICE_CLOCK_TECHNICIAN_DEFAULT_WORK_TYPE_LEVEL2_ID.',
    }
  }
  return { ok: true, line }
}
