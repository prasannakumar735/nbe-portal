import type { SupabaseClient } from '@supabase/supabase-js'
import { locationLabelFromDbRow } from '@/lib/supabase/clientLocationsDb'
import { clientNameFromDbRow } from '@/lib/supabase/clientsDb'

/**
 * Resolves client and location labels for maintenance emails/PDFs.
 * Uses the same naming rules as `buildMaintenancePdfOptions` (includes `clients.client_name`).
 */
export async function resolveClientLocationForReport(
  supabase: SupabaseClient,
  clientLocationId: string | null | undefined,
): Promise<{ clientName: string; locationName: string }> {
  if (!clientLocationId) {
    return { clientName: 'Unknown Client', locationName: 'Unknown Location' }
  }

  const { data: locationData } = await supabase
    .from('client_locations')
    .select('*')
    .eq('id', clientLocationId)
    .maybeSingle()

  if (!locationData) {
    return { clientName: 'Unknown Client', locationName: 'Unknown Location' }
  }

  const loc = locationData as Record<string, unknown>
  const locationName = locationLabelFromDbRow(
    locationData as Parameters<typeof locationLabelFromDbRow>[0],
  )

  let clientName = ''
  const clientId = loc.client_id
  if (clientId) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle()

    if (clientData) {
      clientName = clientNameFromDbRow(
        clientData as Parameters<typeof clientNameFromDbRow>[0],
      )
    }
  }

  return {
    clientName: clientName || 'Unknown Client',
    locationName,
  }
}
