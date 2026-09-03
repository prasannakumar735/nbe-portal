import type { SupabaseClient } from '@supabase/supabase-js'

export const DUPLICATE_SERIAL_MESSAGE = 'A door with this serial number already exists at that location.'

export async function doorSerialExistsAtLocation(
  supabase: SupabaseClient,
  clientLocationId: string,
  doorSerial: string,
  excludeDoorId?: string,
): Promise<boolean> {
  let query = supabase
    .from('doors')
    .select('id')
    .eq('client_location_id', clientLocationId)
    .eq('door_serial', doorSerial)
    .limit(1)

  if (excludeDoorId) {
    query = query.neq('id', excludeDoorId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return Boolean(data?.id)
}

export function isDoorsUniqueViolation(error: { code?: string } | null): boolean {
  return String(error?.code ?? '') === '23505'
}
