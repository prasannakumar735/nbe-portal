'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/providers/AuthProvider'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { offlineDelete, offlineListAll, offlineSetStatus } from '@/lib/offline-db'
import type { OfflineInspectionRecord } from '@/lib/offline-db'

type ReportRow = {
  id: string
  report_number: string
  client_name: string
  location_name: string
  technician_name: string
  inspection_date: string
  status: string
  pdf_url: string | null
}

type MergedReportRow = {
  id: string
  client_id: string
  client_name: string
  report_ids: string[]
  created_by: string
  created_at: string
  file_url: string | null
}

const statusStyles: Record<string, string> = {
  draft: 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700',
  submitted: 'rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800',
  reviewing: 'rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-800',
  approved: 'rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-800',
  rejected: 'rounded-full bg-red-200 px-2 py-0.5 text-xs font-semibold text-red-800',
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    reviewing: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return labels[status] ?? status
}

export default function MaintenanceDashboardPage() {
  const { isManager, isAdmin } = useAuth()
  const canMergeReports = isManager || isAdmin
  const { isOnline } = useOnlineStatus()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [mergedReports, setMergedReports] = useState<MergedReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMerged, setLoadingMerged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [merging, setMerging] = useState(false)
  const [offlineReports, setOfflineReports] = useState<OfflineInspectionRecord[]>([])
  const [offlineLoading, setOfflineLoading] = useState(false)
  const [offlineSyncingAll, setOfflineSyncingAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchReports = async () => {
      try {
        const res = await fetch('/api/maintenance/reports')
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to load reports')
        }
        if (!cancelled) {
          setReports(data.reports ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load reports')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    fetchReports()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!canMergeReports) return
    let cancelled = false
    const fetchMerged = async () => {
      setLoadingMerged(true)
      try {
        const res = await fetch('/api/maintenance/merged-reports')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load merged reports')
        if (!cancelled) setMergedReports(data.merged_reports ?? [])
      } catch (e) {
        // non-blocking; keep main reports usable
        if (!cancelled) console.warn(e)
      } finally {
        if (!cancelled) setLoadingMerged(false)
      }
    }
    fetchMerged()
    return () => { cancelled = true }
  }, [canMergeReports])

  useEffect(() => {
    // Keep selection in sync if list refreshes/changes
    setSelectedReports((prev) => prev.filter((id) => reports.some((r) => r.id === id)))
  }, [reports])

  const refreshOffline = async () => {
    setOfflineLoading(true)
    try {
      setOfflineReports(await offlineListAll())
    } finally {
      setOfflineLoading(false)
    }
  }

  useEffect(() => {
    void refreshOffline()
    const interval = window.setInterval(() => void refreshOffline(), 4000)
    return () => window.clearInterval(interval)
  }, [])

  const syncOneOffline = async (record: OfflineInspectionRecord) => {
    if (!navigator.onLine) return
    if (record.status === 'syncing') return
    await offlineSetStatus(record.id, 'syncing')
    await refreshOffline()
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'submitted', form: record.report_data }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Sync failed')
      await offlineSetStatus(record.id, 'synced')
    } catch {
      await offlineSetStatus(record.id, 'pending')
    } finally {
      await refreshOffline()
    }
  }

  const syncAllOffline = async () => {
    if (!navigator.onLine || offlineSyncingAll) return
    setOfflineSyncingAll(true)
    try {
      const list = await offlineListAll()
      for (const r of list) {
        if (!navigator.onLine) break
        if (r.status !== 'pending') continue
        await syncOneOffline(r)
      }
    } finally {
      setOfflineSyncingAll(false)
    }
  }

  const toggleSelected = (reportId: string, checked: boolean) => {
    setSelectedReports((prev) => {
      if (checked) return prev.includes(reportId) ? prev : [...prev, reportId]
      return prev.filter((id) => id !== reportId)
    })
  }

  const handleMergeReports = async () => {
    if (selectedReports.length < 2 || merging) return
    setNotice(null)
    setError(null)
    setMerging(true)
    try {
      const res = await fetch('/api/maintenance/merge-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: selectedReports }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Merge failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const match = contentDisposition.match(/filename="([^"]+)"/i)
      const filename = match?.[1] || `Merged_Report_${new Date().toISOString().slice(0, 10)}.pdf`

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      setNotice('Merged report downloaded')
      setSelectedReports([])

      if (canMergeReports) {
        // refresh merged list after successful merge
        const mergedRes = await fetch('/api/maintenance/merged-reports')
        const mergedData = await mergedRes.json().catch(() => ({}))
        if (mergedRes.ok) {
          setMergedReports((mergedData as { merged_reports?: MergedReportRow[] }).merged_reports ?? [])
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Merge failed'
      setError(msg)
      alert(msg)
    } finally {
      setMerging(false)
    }
  }

  const handleDownloadMergedReport = async (mergedReportId: string) => {
    try {
      const res = await fetch(`/api/maintenance/merged-reports/${mergedReportId}/pdf`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const match = contentDisposition.match(/filename="([^"]+)"/i)
      const filename = match?.[1] || `Merged_Report_${new Date().toISOString().slice(0, 10)}.pdf`

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Download failed')
    }
  }

  const handleDownloadReport = async (reportId: string) => {
    try {
      const res = await fetch(`/api/maintenance/pdf/${reportId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `maintenance-report-${reportId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Download failed')
    }
  }

  const handleDownloadPdf = async (reportId: string, _pdfUrl: string | null) => {
    try {
      const res = await fetch(`/api/maintenance/pdf/${reportId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'PDF generation failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF generation failed')
    }
  }

  const handleDownloadAllPhotos = async (reportId: string) => {
    try {
      const res = await fetch(`/api/maintenance/photos/${reportId}/zip`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `maintenance-photos-${reportId.slice(0, 8)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Download failed')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Reports</h1>
          <p className="mt-1 text-sm text-slate-600">View and manage maintenance inspection reports</p>
        </div>
        <Link
          href="/maintenance/new?fresh=1"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-base font-bold text-white hover:bg-slate-800"
        >
          New Maintenance Report
        </Link>
      </header>

      {canMergeReports && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-700">
            <span className="font-semibold">{selectedReports.length}</span> reports selected
          </div>
          <button
            type="button"
            onClick={handleMergeReports}
            disabled={selectedReports.length < 2 || merging}
            className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold ${
              selectedReports.length < 2 || merging
                ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {merging ? 'Merging reports…' : 'Merge Reports'}
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Offline Reports</h2>
            <p className="text-xs text-slate-600">Reports saved locally on this device (offline-safe)</p>
          </div>
          <div className="flex items-center gap-2">
            {offlineLoading && <span className="text-xs text-slate-500">Loading…</span>}
            <button
              type="button"
              onClick={() => void syncAllOffline()}
              disabled={!isOnline || offlineSyncingAll || offlineReports.filter(r => r.status === 'pending').length === 0}
              className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {offlineSyncingAll ? 'Syncing…' : 'Sync Pending Reports'}
            </button>
          </div>
        </div>

        {offlineReports.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">No offline reports.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-4 py-3 font-semibold text-slate-700">Created</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Technician</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Client</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {offlineReports.map((r) => {
                  const statusLabel =
                    r.status === 'syncing'
                      ? 'Syncing...'
                      : r.status === 'synced'
                        ? 'Synced ✅'
                        : (r.attempt_count ?? 0) > 0
                          ? 'Failed ❌'
                          : 'Pending'
                  const statusStyle =
                    r.status === 'syncing'
                      ? 'bg-blue-100 text-blue-800'
                      : r.status === 'synced'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (r.attempt_count ?? 0) > 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-800">{r.report_data.technician_name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {r.report_data.client_id ? r.report_data.client_id.slice(0, 8) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void syncOneOffline(r)}
                            disabled={!isOnline || r.status === 'syncing' || r.status === 'synced'}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Sync
                          </button>
                          <Link
                            href={`/maintenance/new?offline_id=${encodeURIComponent(r.id)}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => void (async () => { await offlineDelete(r.id); await refreshOffline() })()}
                            disabled={r.status === 'syncing'}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canMergeReports && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Merged Reports</h2>
              <p className="text-xs text-slate-600">Previously merged PDFs</p>
            </div>
            {loadingMerged && <span className="text-xs text-slate-500">Loading…</span>}
          </div>

          {mergedReports.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">No merged reports yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="px-4 py-3 font-semibold text-slate-700">Client</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Reports</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Created</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedReports.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{m.client_name}</td>
                      <td className="px-4 py-3 text-slate-700">{Array.isArray(m.report_ids) ? m.report_ids.length : 0}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDownloadMergedReport(m.id)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-slate-500">Loading reports…</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-slate-600">No maintenance reports yet.</p>
            <Link
              href="/maintenance/new?fresh=1"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              New Maintenance Report
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {canMergeReports && (
                    <th className="w-12 px-4 py-3 font-semibold text-slate-700">
                      <span className="sr-only">Select</span>
                    </th>
                  )}
                  <th className="px-4 py-3 font-semibold text-slate-700">Report ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Client</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Location</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Technician</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Inspection Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
                    {canMergeReports && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedReports.includes(report.id)}
                          onChange={(e) => toggleSelected(report.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          aria-label={`Select report ${report.report_number ?? report.id.slice(0, 8)}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {report.report_number ?? report.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{report.client_name}</td>
                    <td className="px-4 py-3 text-slate-800">{report.location_name}</td>
                    <td className="px-4 py-3 text-slate-800">{report.technician_name}</td>
                    <td className="px-4 py-3 text-slate-800">{report.inspection_date}</td>
                    <td className="px-4 py-3">
                      <span className={statusStyles[report.status] ?? statusStyles.draft}>
                        {statusLabel(report.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/maintenance/${report.id}`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View Report
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDownloadReport(report.id)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Download Report
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(report.id, report.pdf_url)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAllPhotos(report.id)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Download All Photos
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
