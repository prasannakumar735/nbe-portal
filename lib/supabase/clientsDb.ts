/**
 * `public.clients` uses column `name` (not `client_name`) in this project.
 * Map DB rows to API/UI shape `{ id, client_name, created_at }`.
 */
export function clientNameFromDbRow(row: { name?: string | null; client_name?: string | null; company_name?: string | null } | null | undefined): string {
  return String(row?.name ?? row?.client_name ?? row?.company_name ?? '').trim() || 'Unknown Client'
}

export function mapClientDbRowToApi(row: {
  id: string
  name?: string | null
  client_name?: string | null
  company_name?: string | null
  created_at?: string | null
}) {
  return {
    id: row.id,
    client_name: clientNameFromDbRow(row),
    created_at: row.created_at ?? null,
  }
}
