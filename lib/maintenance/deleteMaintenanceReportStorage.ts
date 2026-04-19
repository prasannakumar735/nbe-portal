import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'maintenance-images'

/**
 * Best-effort removal of Storage objects for a report (PDFs, per-door photos, signatures).
 * Safe to call before deleting the `maintenance_reports` row.
 */
export async function deleteMaintenanceReportStorageAssets(
  supabase: SupabaseClient,
  reportId: string,
): Promise<void> {
  const storage = supabase.storage.from(BUCKET)

  const removeBatch = async (paths: string[]) => {
    if (paths.length === 0) return
    for (let i = 0; i < paths.length; i += 80) {
      await storage.remove(paths.slice(i, i + 80)).catch(() => {})
    }
  }

  const reportPdfFolder = `reports/${reportId}`
  const { data: pdfFiles } = await storage.list(reportPdfFolder, { limit: 200 })
  if (pdfFiles?.length) {
    await removeBatch(pdfFiles.map(f => `${reportPdfFolder}/${f.name}`))
  }

  const { data: doorDirs } = await storage.list(reportId, { limit: 200 })
  if (doorDirs?.length) {
    for (const dir of doorDirs) {
      const dirPath = `${reportId}/${dir.name}`
      const { data: shots } = await storage.list(dirPath, { limit: 500 })
      if (shots?.length) {
        await removeBatch(shots.map(s => `${dirPath}/${s.name}`))
      }
    }
  }

  const sigPrefix = `signatures/${reportId}`
  const { data: sigFiles } = await storage.list(sigPrefix, { limit: 50 })
  if (sigFiles?.length) {
    await removeBatch(sigFiles.map(f => `${sigPrefix}/${f.name}`))
  }
}
