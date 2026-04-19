/**
 * Human-readable site label: column `location_name` (see migration 050 if missing in your DB).
 * Falls back to legacy `name` / `site_name` / `suburb`, then address fields, before "Unknown Location".
 *
 * Resolves **both** `Company_address` and `company_address` (Postgres / PostgREST casing varies).
 * Treats the literal string `"null"` as empty (bad imports / exports).
 */
function coalesceText(value: unknown): string {
  if (value == null) return ''
  const s = String(value).trim()
  if (!s || s.toLowerCase() === 'null') return ''
  return s
}

function firstNonEmptyField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const t = coalesceText(row[k])
    if (t) return t
  }
  return ''
}

export function locationLabelFromDbRow(
  row:
    | {
        location_name?: string | null
        name?: string | null
        site_name?: string | null
        suburb?: string | null
        Company_address?: string | null
        company_address?: string | null
        address?: string | null
        site_address?: string | null
        location_address?: string | null
      }
    | null
    | undefined,
): string {
  if (row == null || typeof row !== 'object') return 'Unknown Location'
  const r = row as Record<string, unknown>

  const primary = firstNonEmptyField(r, ['location_name', 'name', 'site_name', 'suburb'])
  if (primary) return primary

  const addr = firstNonEmptyField(r, [
    'Company_address',
    'company_address',
    'address',
    'site_address',
    'location_address',
  ])
  if (addr) return addr

  return 'Unknown Location'
}

export type ClientLocationDbRow = {
  id: string
  client_id?: string | null
  location_name?: string | null
  name?: string | null
  site_name?: string | null
  Company_address?: string | null
  suburb?: string | null
  created_at?: string | null
}

export function mapLocationDbRowToApi(row: ClientLocationDbRow) {
  const r = row as unknown as Record<string, unknown>
  const companyAddr = coalesceText(r.Company_address) || coalesceText(r.company_address) || null
  return {
    id: row.id,
    client_id: String(row.client_id ?? ''),
    location_name: locationLabelFromDbRow(row),
    Company_address: companyAddr,
    suburb: row.suburb != null ? coalesceText(row.suburb) || null : null,
    created_at: row.created_at ?? undefined,
  }
}

/** Persisted columns for admin CRUD (requires `location_name` — run migration 050 on older DBs). */
export const CLIENT_LOCATIONS_DB_COLUMNS = 'id, client_id, location_name, Company_address, suburb, created_at'
