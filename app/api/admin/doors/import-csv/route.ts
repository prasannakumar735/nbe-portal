import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { clientNameFromDbRow } from '@/lib/supabase/clientsDb'
import { locationLabelFromDbRow } from '@/lib/supabase/clientLocationsDb'
import { csvDoorImportRequestSchema, type CsvDoorRowInput } from '@/lib/validation/admin-clients'

export const runtime = 'nodejs'

type ImportError = { rowIndex: number; message: string }

type ResolvedDoorRow = {
  client_location_id: string
  door_label: string
  door_type: string
  door_description: string | null
  door_type_alt: string | null
  cw: string | null
  ch: string | null
  install_date: string | null
}

const keyOf = (value: string) => value.trim().toLowerCase()

function chunkRows<T>(rows: T[], size = 500): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = csvDoorImportRequestSchema.parse(body)
    const previewOnly = Boolean((body as { preview?: unknown })?.preview)
    const errors: ImportError[] = []
    const resolvedRows: ResolvedDoorRow[] = []
    let skipped = 0

    const { data: clients, error: clientsError } = await auth.supabase
      .from('clients')
      .select('id, name, company_name')
      .limit(5000)
    if (clientsError) return fail(clientsError.message, 400)

    const { data: locations, error: locationsError } = await auth.supabase
      .from('client_locations')
      .select('id, client_id, location_name, suburb')
      .limit(10000)
    if (locationsError) return fail(locationsError.message, 400)

    const clientIdByName = new Map<string, string>()
    for (const row of clients ?? []) {
      const label = clientNameFromDbRow(row as { name?: string | null; client_name?: string | null; company_name?: string | null })
      const mapKey = keyOf(label)
      if (mapKey && !clientIdByName.has(mapKey)) {
        clientIdByName.set(mapKey, String((row as { id?: string }).id ?? ''))
      }
    }

    const locationIdByClientAndName = new Map<string, string>()
    for (const row of locations ?? []) {
      const clientId = String((row as { client_id?: string }).client_id ?? '')
      const locName = keyOf(locationLabelFromDbRow(row as { location_name?: string | null; name?: string | null; site_name?: string | null; suburb?: string | null }))
      if (!clientId || !locName) continue
      const key = `${clientId}::${locName}`
      if (!locationIdByClientAndName.has(key)) {
        locationIdByClientAndName.set(key, String((row as { id?: string }).id ?? ''))
      }
    }

    const ensureClient = async (name: string): Promise<string | null> => {
      const key = keyOf(name)
      const existing = clientIdByName.get(key)
      if (existing) return existing
      if (!parsed.createMissing) return null

      const { data, error } = await auth.supabase
        .from('clients')
        .insert({ name })
        .select('id, name')
        .single()

      if (error || !data?.id) return null
      clientIdByName.set(key, data.id)
      return data.id
    }

    const ensureLocation = async (clientId: string, locationName: string): Promise<string | null> => {
      const key = `${clientId}::${keyOf(locationName)}`
      const existing = locationIdByClientAndName.get(key)
      if (existing) return existing
      if (!parsed.createMissing) return null

      const { data, error } = await auth.supabase
        .from('client_locations')
        .insert({
          client_id: clientId,
          location_name: locationName,
          Company_address: 'Address pending',
        })
        .select('id')
        .single()

      if (error || !data?.id) return null
      locationIdByClientAndName.set(key, data.id)
      return data.id
    }

    for (let index = 0; index < parsed.rows.length; index += 1) {
      const row: CsvDoorRowInput = parsed.rows[index]
      const rowIndex = index + 1
      const clientName = String(row.client_name ?? '').trim()
      const locationName = String(row.location_name ?? '').trim()
      const doorLabel = String(row.door_label ?? '').trim()
      const doorType = String(row.door_type ?? '').trim()

      const clientId = await ensureClient(clientName)
      if (!clientId) {
        errors.push({ rowIndex, message: `Client not found: "${clientName}"` })
        skipped += 1
        continue
      }

      const locationId = await ensureLocation(clientId, locationName)
      if (!locationId) {
        errors.push({ rowIndex, message: `Location not found under client "${clientName}": "${locationName}"` })
        skipped += 1
        continue
      }

      resolvedRows.push({
        client_location_id: locationId,
        door_label: doorLabel,
        door_type: doorType,
        door_description: row.door_description,
        door_type_alt: row.door_type_alt,
        cw: row.cw,
        ch: row.ch,
        install_date: row.install_date,
      })
    }

    if (previewOnly) {
      return ok({
        inserted: 0,
        skipped,
        to_create: resolvedRows.length,
        errors,
        preview: resolvedRows.slice(0, 25),
      })
    }

    for (const chunk of chunkRows(resolvedRows, 500)) {
      if (!chunk.length) continue
      const { error } = await auth.supabase.from('doors').insert(chunk)
      if (error) {
        return fail(error.message, 400, errors)
      }
    }

    return ok({
      inserted: resolvedRows.length,
      skipped,
      errors,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'CSV import failed', 500)
  }
}
