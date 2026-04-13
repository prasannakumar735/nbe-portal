import type { SupabaseClient } from '@supabase/supabase-js'
import { MERGED_MAINTENANCE_REPORTS_BUCKET } from '@/lib/merged-reports/storage'

type OkNotFound = { ok: true } | { ok: false; code: 'not_found' }
type SoftResult = { ok: true } | { ok: false; code: 'not_found' | 'already_deleted' }
type RestoreResult = { ok: true } | { ok: false; code: 'not_found' | 'not_deleted' }

/**
 * Soft-delete: marks row only. Storage file is kept until hard purge or manual cleanup.
 */
export async function softDeleteMergedReport(
  supabase: SupabaseClient,
  mergedReportId: string,
  deletedByUserId: string,
): Promise<SoftResult> {
  const { data: row, error: fetchErr } = await supabase
    .from('merged_reports')
    .select('id, deleted_at')
    .eq('id', mergedReportId)
    .maybeSingle()

  if (fetchErr) {
    throw fetchErr
  }

  if (!row?.id) {
    return { ok: false, code: 'not_found' }
  }

  if ((row as { deleted_at?: string | null }).deleted_at) {
    return { ok: false, code: 'already_deleted' }
  }

  const { error: updErr } = await supabase
    .from('merged_reports')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedByUserId,
    })
    .eq('id', mergedReportId)

  if (updErr) {
    throw updErr
  }

  return { ok: true }
}

/** Restore a soft-deleted merged report. */
export async function restoreMergedReport(
  supabase: SupabaseClient,
  mergedReportId: string,
): Promise<RestoreResult> {
  const { data: row, error: fetchErr } = await supabase
    .from('merged_reports')
    .select('id, deleted_at')
    .eq('id', mergedReportId)
    .maybeSingle()

  if (fetchErr) {
    throw fetchErr
  }

  if (!row?.id) {
    return { ok: false, code: 'not_found' }
  }

  if (!(row as { deleted_at?: string | null }).deleted_at) {
    return { ok: false, code: 'not_deleted' }
  }

  const { error: updErr } = await supabase
    .from('merged_reports')
    .update({
      deleted_at: null,
      deleted_by: null,
    })
    .eq('id', mergedReportId)

  if (updErr) {
    throw updErr
  }

  return { ok: true }
}

/**
 * Hard delete: removes PDF from storage (when path exists) and deletes the DB row.
 * Used by purge jobs and optional permanent cleanup — not for normal user delete.
 */
export async function hardDeleteMergedReportRow(
  supabase: SupabaseClient,
  mergedReportId: string,
): Promise<OkNotFound> {
  const { data: row, error: fetchErr } = await supabase
    .from('merged_reports')
    .select('id, pdf_storage_path')
    .eq('id', mergedReportId)
    .maybeSingle()

  if (fetchErr) {
    throw fetchErr
  }

  if (!row?.id) {
    return { ok: false, code: 'not_found' }
  }

  const storagePath = String((row as { pdf_storage_path?: string | null }).pdf_storage_path ?? '').trim()
  if (storagePath) {
    const { error: rmErr } = await supabase.storage.from(MERGED_MAINTENANCE_REPORTS_BUCKET).remove([storagePath])
    if (rmErr) {
      console.warn('[hardDeleteMergedReportRow] Storage remove failed', {
        mergedReportId,
        storagePath,
        message: rmErr.message,
      })
    }
  }

  const { error: delErr } = await supabase.from('merged_reports').delete().eq('id', mergedReportId)
  if (delErr) {
    throw delErr
  }

  return { ok: true }
}

/** Permanently remove soft-deleted rows older than `olderThanDays`. Returns count purged. */
export async function purgeSoftDeletedMergedReportsOlderThan(
  supabase: SupabaseClient,
  olderThanDays: number,
): Promise<{ purged: number; errors: string[] }> {
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()

  const { data: rows, error: listErr } = await supabase
    .from('merged_reports')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffIso)

  if (listErr) {
    throw listErr
  }

  let purged = 0
  const errors: string[] = []
  for (const r of rows ?? []) {
    const id = String((r as { id: string }).id ?? '').trim()
    if (!id) continue
    try {
      const result = await hardDeleteMergedReportRow(supabase, id)
      if (result.ok) {
        purged += 1
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return { purged, errors }
}
