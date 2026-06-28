import type { SupabaseClient } from '@supabase/supabase-js'

const DUPLICATE_LABEL_MESSAGE = 'A door with this label already exists at that location.'

export { DUPLICATE_LABEL_MESSAGE }

export async function doorLabelExistsAtLocation(
  supabase: SupabaseClient,
  clientLocationId: string,
  doorLabel: string,
  excludeDoorId?: string,
): Promise<boolean> {
  let query = supabase
    .from('doors')
    .select('id')
    .eq('client_location_id', clientLocationId)
    .eq('door_label', doorLabel)
    .limit(1)

  if (excludeDoorId) {
    query = query.neq('id', excludeDoorId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw error
  }
  return Boolean(data?.id)
}

export function isDoorsUniqueViolation(error: { code?: string } | null): boolean {
  return String(error?.code ?? '') === '23505'
}
