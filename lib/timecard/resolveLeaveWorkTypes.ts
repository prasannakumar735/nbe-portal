import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedLeaveWorkTypes = {
  work_type_level1_id: string
  work_type_level2_id: string
  level1Code: string
  level2Name: string
}

export async function resolveAnnualLeaveWorkTypes(
  supabase: SupabaseClient,
): Promise<ResolvedLeaveWorkTypes> {
  const { data: l1, error: e1 } = await supabase
    .from('work_type_level1')
    .select('id, code')
    .ilike('code', 'lvh')
    .limit(1)
    .maybeSingle()
  if (e1 || !l1?.id) {
    throw new Error('Leave work type LVH is not configured in work_type_level1.')
  }

  const { data: l2Rows, error: e2 } = await supabase
    .from('work_type_level2')
    .select('id, name, code')
    .eq('level1_id', String(l1.id))
  if (e2 || !l2Rows?.length) {
    throw new Error('No level-2 tasks under LVH.')
  }

  const alv =
    l2Rows.find(r => String(r.code ?? '').trim().toUpperCase() === 'ALV') ??
    l2Rows.find(r => String(r.name ?? '').toLowerCase().includes('annual leave'))
  if (!alv?.id) {
    throw new Error('Annual leave (ALV) work type is not configured under LVH.')
  }

  return {
    work_type_level1_id: String(l1.id),
    work_type_level2_id: String(alv.id),
    level1Code: String(l1.code ?? 'LVH'),
    level2Name: String(alv.name ?? 'Annual Leave'),
  }
}
