import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { clientNameFromDbRow } from '@/lib/supabase/clientsDb'
import { csvLocationImportRequestSchema, type CsvLocationRowInput } from '@/lib/validation/admin-clients'



type ImportError = { rowIndex: number; message: string }

type ResolvedLocationRow = {
  client_id: string
  location_name: string
  Company_address: string
  suburb: string | null
}

const keyOf = (value: string) => value.trim().toLowerCase()

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = csvLocationImportRequestSchema.parse(body)
    const previewOnly = Boolean((body as { preview?: unknown })?.preview)
    const errors: ImportError[] = []
    const resolvedRows: ResolvedLocationRow[] = []
    let skipped = 0
    let duplicates = 0

    const { data: clients, error: clientsError } = await auth.supabase
      .from('clients')
      .select('id, name')
      .limit(5000)
    if (clientsError) return fail(clientsError.message, 400)

    const { data: existingLocations, error: locationsError } = await auth.supabase
      .from('client_locations')
      .select('client_id, location_name')
      .limit(20000)
    if (locationsError) return fail(locationsError.message, 400)

    const clientIdByName = new Map<string, string>()
    for (const row of clients ?? []) {
      const label = clientNameFromDbRow(row as { name?: string | null; client_name?: string | null; company_name?: string | null })
      const mapKey = keyOf(label)
      if (mapKey && !clientIdByName.has(mapKey)) {
        clientIdByName.set(mapKey, String((row as { id?: string }).id ?? ''))
      }
    }

    const existingLocationKeys = new Set<string>()
    for (const row of existingLocations ?? []) {
      const clientId = String((row as { client_id?: string }).client_id ?? '')
      const locName = keyOf(String((row as { location_name?: string }).location_name ?? ''))
      if (clientId && locName) {
        existingLocationKeys.add(`${clientId}::${locName}`)
      }
    }

    for (let index = 0; index < parsed.rows.length; index += 1) {
      const row: CsvLocationRowInput = parsed.rows[index]
      const rowIndex = index + 1
      const clientName = String(row.client_name ?? '').trim()
      const locationName = String(row.location_name ?? '').trim()

      const clientId = clientIdByName.get(keyOf(clientName))
      if (!clientId) {
        errors.push({ rowIndex, message: `Client not found: "${clientName}"` })
        skipped += 1
        continue
      }

      const dupKey = `${clientId}::${keyOf(locationName)}`
      if (existingLocationKeys.has(dupKey)) {
        errors.push({ rowIndex, message: `Location already exists under client "${clientName}": "${locationName}"` })
        duplicates += 1
        continue
      }

      resolvedRows.push({
        client_id: clientId,
        location_name: locationName,
        Company_address: String(row.Company_address ?? '').trim(),
        suburb: row.suburb ?? null,
      })

      // Prevent duplicate rows within the same file
      existingLocationKeys.add(dupKey)
    }

    if (previewOnly) {
      return ok({
        inserted: 0,
        skipped,
        duplicates,
        to_create: resolvedRows.length,
        errors,
        preview: resolvedRows.slice(0, 25),
      })
    }

    if (resolvedRows.length > 0) {
      const { error } = await auth.supabase.from('client_locations').insert(resolvedRows)
      if (error) return fail(error.message, 400, errors)
    }

    return ok({
      inserted: resolvedRows.length,
      skipped,
      duplicates,
      errors,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'CSV import failed', 500)
  }
}
