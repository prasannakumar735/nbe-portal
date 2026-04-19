import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

/**
 * Best-effort analytics (service role). Call only after JWT auth + `checkMergedReportClientGate` / equivalent
 * (e.g. `app/report/view/[token]/page.tsx`).
 */
export async function recordMergedReportView(mergedReportId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: row } = await supabase
    .from('merged_reports')
    .select('view_count')
    .eq('id', mergedReportId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row) return

  const next = (typeof row.view_count === 'number' ? row.view_count : 0) + 1
  await supabase
    .from('merged_reports')
    .update({
      view_count: next,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', mergedReportId)
}
