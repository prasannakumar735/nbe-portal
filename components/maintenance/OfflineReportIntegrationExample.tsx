'use client'

import { formatOfflineSaveStatus, useOfflineReport } from '@/hooks/useOfflineReport'

/**
 * Minimal example of the offline-first report hook. Production wiring lives in
 * `app/(portal)/maintenance/[reportId]/page.tsx` together with `MaintenanceInspectionForm`.
 */
export function OfflineReportIntegrationExample(props: { reportId: string }) {
  const offline = useOfflineReport(props.reportId)

  if (offline.status === 'loading') {
    return <p className="text-sm text-slate-600">Restoring from IndexedDB / server…</p>
  }

  if (offline.status === 'error') {
    return <p className="text-sm text-red-600">Could not load report offline state.</p>
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <p className="font-medium">{formatOfflineSaveStatus(offline.saveStatus)}</p>
      <p className="mt-1">Pending sync: {offline.hasPendingSync ? 'yes' : 'no'}</p>
      <p className="mt-1">Doors in memory: {offline.initialForm?.doors?.length ?? 0}</p>
    </div>
  )
}
