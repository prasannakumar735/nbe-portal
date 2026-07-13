/** Detect PostgREST / Postgres errors when a table or view is missing (migration not applied). */
export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = String((error as { code?: string }).code ?? '')
  const message = String((error as { message?: string }).message ?? '').toLowerCase()
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') return true
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
}

export const SALES_EMAIL_ATTACHMENTS_MIGRATION_HINT =
  'Apply database migration lib/db/migrations/111_sales_email_attachments.sql (and reload the Supabase API schema if needed).'
