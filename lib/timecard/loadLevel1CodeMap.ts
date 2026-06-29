import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadLevel1CodeMap(
  supabase: SupabaseClient,
  level1Ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(level1Ids.map(id => String(id).trim()).filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const { data, error } = await supabase.from('work_type_level1').select('id, code').in('id', unique)
  if (error) {
    console.warn('[loadLevel1CodeMap]', error.message)
    return map
  }
  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? '')
    const code = String((row as { code?: string }).code ?? '')
    if (id) map.set(id, code)
  }
  return map
}

/** Resolve UUID for LVH level-1 (cached per request). */
export async function resolveLvhLevel1Ids(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('work_type_level1').select('id').ilike('code', 'lvh')
  if (error) {
    console.warn('[resolveLvhLevel1Ids]', error.message)
    return new Set()
  }
  return new Set((data ?? []).map(r => String((r as { id: string }).id)))
}
