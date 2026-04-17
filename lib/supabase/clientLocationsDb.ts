/**
 * Human-readable site label: column `location_name` (see migration 050 if missing in your DB).
 * `locationLabelFromDbRow` still falls back to legacy `name` / `site_name` / `suburb` when needed.
 */
export function locationLabelFromDbRow(
  row: {
    location_name?: string | null
    name?: string | null
    site_name?: string | null
    suburb?: string | null
  } | null | undefined,
): string {
  return (
    String(row?.location_name ?? row?.name ?? row?.site_name ?? row?.suburb ?? '').trim() || 'Unknown Location'
  )
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
  return {
    id: row.id,
    client_id: String(row.client_id ?? ''),
    location_name: locationLabelFromDbRow(row),
    Company_address: row.Company_address ?? null,
    suburb: row.suburb ?? null,
    created_at: row.created_at ?? null,
  }
}

/** Persisted columns for admin CRUD (requires `location_name` — run migration 050 on older DBs). */
export const CLIENT_LOCATIONS_DB_COLUMNS = 'id, client_id, location_name, Company_address, suburb, created_at'
