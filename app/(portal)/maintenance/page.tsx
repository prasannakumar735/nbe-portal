'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { offlineDelete, offlineListAll, offlineSetStatus } from '@/lib/offline-db'
import type { OfflineInspectionRecord } from '@/lib/offline-db'
import { downloadFile, type DownloadProgress } from '@/lib/browser/downloadFile'
import { formatDateTime } from '@/lib/utils/formatDateTime'

type ReportRow = {
  id: string
  report_number: string
  client_name: string
  location_name: string
  technician_name: string
  inspection_date: string
  status: string
  pdf_url: string | null
  client_view_url: string | null
}

type MergedReportRow = {
  id: string
  client_id: string
  client_name: string
  report_ids: string[]
  created_by: string
  created_at: string
  file_url: string | null
  pdf_url?: string | null
  access_expires_at?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
}

function mergedReportViewHref(m: MergedReportRow): string {
  const u = m.pdf_url?.trim()
  if (u) return u
  return `/api/maintenance/merged-reports/${encodeURIComponent(m.id)}/pdf?inline=1`
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

const MERGE_STEPS = [
  { title: 'Gathering reports', detail: 'Loading selected maintenance reports…' },
  { title: 'Building PDFs', detail: 'Rendering each report segment…' },
  { title: 'Merging & signing', detail: 'Combining PDFs and applying sign-off…' },
  { title: 'Finishing up', detail: 'Encoding file and preparing your download…' },
] as const

function CollapsibleReportSection({
  sectionId,
  title,
  subtitle,
  badge,
  open,
  onToggle,
  variant = 'default',
  headerAside,
  children,
}: {
  sectionId: string
  title: string
  subtitle: string
  badge?: number
  open: boolean
  onToggle: () => void
  variant?: 'default' | 'amber'
  headerAside?: ReactNode
  children: ReactNode
}) {
  const wrap =
    variant === 'amber'
      ? 'overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm'
      : 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
  const header =
    variant === 'amber'
      ? 'border-b border-amber-200 bg-amber-50 hover:bg-amber-100/80'
      : 'border-b border-slate-200 bg-slate-50 hover:bg-slate-100/80'

  const headingId = `maint-section-h-${sectionId}`
  const panelId = `maint-section-panel-${sectionId}`

  return (
    <div className={wrap}>
      <div className={`flex w-full items-stretch gap-1 transition-colors ${header}`}>
        <button
          type="button"
          id={headingId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">
              {title}
              {badge != null && badge > 0 ? (
                <span className="ml-2 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 tabular-nums">
                  {badge}
                </span>
              ) : null}
            </h2>
            <p className="text-xs text-slate-600">{subtitle}</p>
          </div>
        </button>
        {headerAside ? (
          <div className="flex shrink-0 items-center border-l border-slate-200/80 px-2 py-2">{headerAside}</div>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex shrink-0 items-center px-3 text-slate-600 hover:text-slate-900"
          aria-label={open ? 'Collapse section' : 'Expand section'}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={headingId}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

function canSelectReportForMerge(report: ReportRow): boolean {
  return report.status !== 'draft'
}

export default function MaintenanceDashboardPage() {
  const { isManager, isAdmin } = useAuth()
  const canMergeReports = isManager || isAdmin
  const canDeleteMergedReports = isAdmin || isManager
  const { isOnline } = useOnlineStatus()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [mergedReports, setMergedReports] = useState<MergedReportRow[]>([])
  const [mergedDeletedReports, setMergedDeletedReports] = useState<MergedReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMerged, setLoadingMerged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [merging, setMerging] = useState(false)
  const [mergeStepIndex, setMergeStepIndex] = useState(0)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeTotalDoorsInput, setMergeTotalDoorsInput] = useState('')
  const [mergeDoorsFieldError, setMergeDoorsFieldError] = useState<string | null>(null)
  const [deletingMergedId, setDeletingMergedId] = useState<string | null>(null)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [restoringMergedId, setRestoringMergedId] = useState<string | null>(null)
  const [offlineReports, setOfflineReports] = useState<OfflineInspectionRecord[]>([])
  const [offlineLoading, setOfflineLoading] = useState(false)
  const [offlineSyncingAll, setOfflineSyncingAll] = useState(false)

  const [openSubmitted, setOpenSubmitted] = useState(true)
  const [openApproved, setOpenApproved] = useState(false)
  const [openDrafts, setOpenDrafts] = useState(true)
  const [openMerged, setOpenMerged] = useState(false)
  const [openDeletedMerged, setOpenDeletedMerged] = useState(false)

  const submittedReports = useMemo(
    () => reports.filter((r) => ['submitted', 'reviewing', 'rejected'].includes(r.status)),
    [reports],
  )
  const approvedReports = useMemo(() => reports.filter((r) => r.status === 'approved'), [reports])
  const draftReports = useMemo(() => reports.filter((r) => r.status === 'draft'), [reports])

  useEffect(() => {
    if (!merging) {
      setMergeStepIndex(0)
      return
    }
    const id = window.setInterval(() => {
      setMergeStepIndex((i) => (i + 1) % MERGE_STEPS.length)
    }, 3200)
    return () => clearInterval(id)
  }, [merging])

  const loadReports = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) {
      setLoading(true)
    }
    try {
      const res = await fetch('/api/maintenance/reports', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load reports')
      }
      setReports(data.reports ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports')
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  const loadMergedLists = useCallback(async () => {
    if (!canMergeReports) return
    try {
      const [activeRes, deletedRes] = await Promise.all([
        fetch('/api/maintenance/merged-reports', { cache: 'no-store' }),
        fetch('/api/maintenance/merged-reports?scope=deleted', { cache: 'no-store' }),
      ])
      const activeData = await activeRes.json().catch(() => ({}))
      const deletedData = await deletedRes.json().catch(() => ({}))
      if (activeRes.ok) {
        setMergedReports((activeData as { merged_reports?: MergedReportRow[] }).merged_reports ?? [])
      }
      if (deletedRes.ok) {
        setMergedDeletedReports((deletedData as { merged_reports?: MergedReportRow[] }).merged_reports ?? [])
      }
    } catch {
      // non-blocking
    }
  }, [canMergeReports])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadReports({ silent: true })
        if (canMergeReports) {
          void loadMergedLists()
        }
      }
    }
    /** BFCache restore can show stale React state; refetch when the page is shown again. */
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        void loadReports({ silent: true })
        if (canMergeReports) {
          void loadMergedLists()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [loadReports, loadMergedLists, canMergeReports])

  useEffect(() => {
    if (!canMergeReports) return
    let cancelled = false
    const run = async () => {
      setLoadingMerged(true)
      try {
        await loadMergedLists()
      } catch (e) {
        if (!cancelled) console.warn(e)
      } finally {
        if (!cancelled) setLoadingMerged(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [canMergeReports, loadMergedLists])

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

  const syncOneOffline = async (
    record: OfflineInspectionRecord,
    options?: { quiet?: boolean },
  ): Promise<boolean> => {
    if (!navigator.onLine) return false
    if (record.status === 'syncing') return false
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
      if (!options?.quiet) {
        toast.success('Offline report synced')
      }
      return true
    } catch (e) {
      await offlineSetStatus(record.id, 'pending')
      if (!options?.quiet) {
        toast.error(e instanceof Error ? e.message : 'Sync failed')
      }
      return false
    } finally {
      await refreshOffline()
    }
  }

  const syncAllOffline = async () => {
    if (!navigator.onLine || offlineSyncingAll) return
    setOfflineSyncingAll(true)
    let synced = 0
    try {
      const list = await offlineListAll()
      for (const r of list) {
        if (!navigator.onLine) break
        if (r.status !== 'pending') continue
        const ok = await syncOneOffline(r, { quiet: true })
        if (ok) synced += 1
      }
      if (synced > 0) {
        toast.success(`Synced ${synced} offline report${synced === 1 ? '' : 's'}`)
      } else {
        toast.message('No pending offline reports to sync')
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

  const openMergeModal = () => {
    if (selectedReports.length < 2 || merging) return
    setMergeDoorsFieldError(null)
    setMergeTotalDoorsInput('')
    setMergeModalOpen(true)
  }

  const closeMergeModal = () => {
    if (merging) return
    setMergeModalOpen(false)
    setMergeDoorsFieldError(null)
  }

  const confirmMergeReports = async () => {
    if (selectedReports.length < 2 || merging) return
    const trimmed = mergeTotalDoorsInput.trim()
    if (trimmed === '') {
      setMergeDoorsFieldError('Enter total doors inspected')
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      setMergeDoorsFieldError('Enter a whole number greater than 0')
      return
    }

    setNotice(null)
    setError(null)
    setMergeDoorsFieldError(null)
    setMerging(true)
    try {
      setDownloadingKey('merge')
      setDownloadProgress({ loaded: 0 })
      await downloadFile('/api/maintenance/merge-reports', {
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportIds: selectedReports, totalDoorsInspected: n }),
        },
        filenameFallback: `Merged_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
        onProgress: p => setDownloadProgress(p),
      })

      toast.success('Reports merged successfully. PDF downloaded.')
      setSelectedReports([])
      setMergeModalOpen(false)
      setMergeTotalDoorsInput('')

      if (canMergeReports) {
        await loadMergedLists()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Merge failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setMerging(false)
      setDownloadingKey(null)
      setDownloadProgress(null)
    }
  }

  const restoreMergedReportById = async (reportId: string, options?: { silent?: boolean }) => {
    const res = await fetch(`/api/maintenance/merged-reports/${encodeURIComponent(reportId)}/restore`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? 'Restore failed')
    }
    await loadMergedLists()
    if (!options?.silent) {
      toast.success('Report restored')
    }
  }

  const handleDeleteMergedReport = async (id: string) => {
    if (!canDeleteMergedReports) return
    if (!window.confirm('Are you sure you want to delete this report?')) return
    setDeletingMergedId(id)
    setError(null)
    try {
      const res = await fetch(`/api/maintenance/merged-reports/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'Delete failed')
      }
      setMergedReports((prev) => prev.filter((r) => r.id !== id))
      toast.success('Report deleted successfully', {
        description: 'You can restore it from Recently deleted or Undo here.',
        duration: 10_000,
        action: {
          label: 'Undo',
          onClick: () => {
            void restoreMergedReportById(id, { silent: true })
              .then(() => toast.success('Report restored'))
              .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not restore'))
          },
        },
      })
      await loadMergedLists()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete report'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeletingMergedId(null)
    }
  }

  const handleDownloadPdf = async (reportId: string) => {
    try {
      setDownloadingKey(`report:${reportId}`)
      setDownloadProgress({ loaded: 0 })
      await downloadFile(`/api/maintenance/pdf/${reportId}`, {
        filenameFallback: `maintenance-report-${reportId.slice(0, 8)}.pdf`,
        onProgress: p => setDownloadProgress(p),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloadingKey(null)
      setDownloadProgress(null)
    }
  }

  const handleDownloadMergedPdf = async (mergedId: string) => {
    try {
      setDownloadingKey(`merged:${mergedId}`)
      setDownloadProgress({ loaded: 0 })
      await downloadFile(`/api/maintenance/merged-reports/${encodeURIComponent(mergedId)}/pdf`, {
        filenameFallback: `merged-report-${mergedId.slice(0, 8)}.pdf`,
        onProgress: p => setDownloadProgress(p),
      })
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloadingKey(null)
      setDownloadProgress(null)
    }
  }

  const handleDeleteMaintenanceReport = async (reportId: string, label: string) => {
    if (!window.confirm(`Delete report ${label}? This cannot be undone.`)) return
    setDeletingReportId(reportId)
    setError(null)
    try {
      const res = await fetch(`/api/maintenance/reports/${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'Delete failed')
      }
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      setSelectedReports((prev) => prev.filter((id) => id !== reportId))
      toast.success('Report deleted')
      await loadReports({ silent: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete report'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeletingReportId(null)
    }
  }

  const handleDownloadAllPhotos = async (reportId: string) => {
    try {
      setDownloadingKey(`photos:${reportId}`)
      setDownloadProgress({ loaded: 0 })
      await downloadFile(`/api/maintenance/photos/${reportId}/zip`, {
        filenameFallback: `maintenance-photos-${reportId.slice(0, 8)}.zip`,
        onProgress: p => setDownloadProgress(p),
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloadingKey(null)
      setDownloadProgress(null)
    }
  }

  const progressLabel = useMemo(() => {
    if (!downloadProgress) return ''
    if (typeof downloadProgress.percent === 'number') return `${downloadProgress.percent}%`
    return '…'
  }, [downloadProgress])

  const renderReportTable = (list: ReportRow[], emptyMessage: string) => {
    if (list.length === 0) {
      return <div className="px-4 py-6 text-sm text-slate-600">{emptyMessage}</div>
    }
    const actionBtn =
      'inline-flex shrink-0 items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium sm:px-3'
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm lg:min-w-0">
          <thead>
            <tr className="border-b border-slate-200 bg-white">
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
              <th className="min-w-[12rem] px-4 py-3 font-semibold text-slate-700 xl:min-w-[28rem]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((report) => (
              <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
                {canMergeReports && (
                  <td className="px-4 py-3">
                    {canSelectReportForMerge(report) ? (
                      <input
                        type="checkbox"
                        checked={selectedReports.includes(report.id)}
                        onChange={(e) => toggleSelected(report.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        aria-label={`Select report ${report.report_number ?? report.id.slice(0, 8)}`}
                      />
                    ) : (
                      <span className="inline-block w-4" aria-hidden />
                    )}
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
                <td className="max-w-[min(100vw-2rem,32rem)] px-4 py-3 align-top xl:max-w-none">
                  <div className="flex flex-wrap gap-1.5 md:flex-nowrap md:gap-2">
                    <Link
                      href={`/maintenance/${report.id}`}
                      className={`${actionBtn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
                    >
                      View Report
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDownloadPdf(report.id)}
                      disabled={downloadingKey === `report:${report.id}`}
                      className={`${actionBtn} border-gray-300 text-slate-800 hover:bg-gray-100`}
                    >
                      {downloadingKey === `report:${report.id}` ? `Downloading ${progressLabel}` : 'Download'}
                    </button>
                    {report.client_view_url ? (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(report.client_view_url!).then(() => {
                            toast.success('Client link copied')
                          })
                        }}
                        className={`${actionBtn} border-emerald-200 bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-100`}
                      >
                        Copy link
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDownloadAllPhotos(report.id)}
                      disabled={downloadingKey === `photos:${report.id}`}
                      className={`${actionBtn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
                    >
                      {downloadingKey === `photos:${report.id}` ? `Downloading ${progressLabel}` : 'All photos'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteMaintenanceReport(
                          report.id,
                          report.report_number ?? report.id.slice(0, 8),
                        )
                      }
                      disabled={deletingReportId === report.id}
                      className={`${actionBtn} border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50`}
                    >
                      {deletingReportId === report.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Maintenance Reports</h1>
          <p className="mt-0.5 text-xs text-slate-600">View and manage maintenance inspection reports</p>
        </div>
        <Link
          href="/maintenance/new?fresh=1"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
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
            onClick={openMergeModal}
            disabled={selectedReports.length < 2 || merging}
            title={
              merging
                ? `${MERGE_STEPS[mergeStepIndex].title}: ${MERGE_STEPS[mergeStepIndex].detail}`
                : undefined
            }
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold ${
              selectedReports.length < 2 || merging
                ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {merging ? (
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-transparent"
                aria-hidden
              />
            ) : null}
            {merging ? (
              <span className="max-w-[14rem] truncate">
                Merging… {mergeStepIndex + 1}/{MERGE_STEPS.length}
              </span>
            ) : (
              'Merge Reports'
            )}
          </button>
        </div>
      )}

      {canMergeReports && mergeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onClick={() => closeMergeModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-busy={merging}
            aria-labelledby="merge-doors-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="merge-doors-title" className="text-lg font-bold text-slate-900">
              Total Doors Inspected
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter the consolidated total for this merged report. It appears once on the first page of the PDF.
            </p>
            <div className="mt-4">
              <label htmlFor="merge-total-doors" className="block text-sm font-semibold text-slate-800">
                Total doors
              </label>
              <input
                id="merge-total-doors"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={mergeTotalDoorsInput}
                disabled={merging}
                onChange={(e) => {
                  setMergeTotalDoorsInput(e.target.value)
                  setMergeDoorsFieldError(null)
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                autoFocus
              />
              {mergeDoorsFieldError && (
                <p className="mt-2 text-sm text-red-600">{mergeDoorsFieldError}</p>
              )}
              {merging && (
                <div
                  className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-slate-700 border-t-transparent"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Step {mergeStepIndex + 1} of {MERGE_STEPS.length}
                        </span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          In progress
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {MERGE_STEPS[mergeStepIndex].title}
                      </p>
                      <p className="text-sm text-slate-600">{MERGE_STEPS[mergeStepIndex].detail}</p>
                      <div className="flex gap-1.5 pt-1" aria-hidden>
                        {MERGE_STEPS.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              i < mergeStepIndex
                                ? 'bg-emerald-500'
                                : i === mergeStepIndex
                                  ? 'bg-slate-800'
                                  : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        This can take a minute for large reports. Please keep this page open until the download
                        starts.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeMergeModal}
                disabled={merging}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmMergeReports()}
                disabled={merging}
                className="inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {merging ? (
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                ) : null}
                {merging ? `Merging… (${mergeStepIndex + 1}/${MERGE_STEPS.length})` : 'Merge & download'}
              </button>
            </div>
          </div>
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

      {!loading && reports.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm text-slate-600">No maintenance reports in your account yet.</p>
          <Link
            href="/maintenance/new?fresh=1"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            New Maintenance Report
          </Link>
        </div>
      )}

      <CollapsibleReportSection
        sectionId="drafts"
        title="Drafted reports"
        subtitle="Server drafts and offline saves on this device"
        badge={draftReports.length + offlineReports.length}
        open={openDrafts}
        onToggle={() => setOpenDrafts((v) => !v)}
        headerAside={
          <div className="flex items-center gap-2">
            {offlineLoading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void syncAllOffline()
              }}
              disabled={!isOnline || offlineSyncingAll || offlineReports.filter((r) => r.status === 'pending').length === 0}
              className="h-8 rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {offlineSyncingAll ? 'Syncing…' : 'Sync offline'}
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">Loading server drafts…</div>
        ) : (
          <>
            <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Server drafts
            </p>
            {renderReportTable(draftReports, 'No draft reports saved on the server.')}
          </>
        )}
        <div className="border-t border-slate-200">
          <p className="bg-slate-50/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Offline (this device)
          </p>
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
                    const offlineStatusLabel =
                      r.status === 'syncing'
                        ? 'Syncing...'
                        : r.status === 'synced'
                          ? 'Synced ✅'
                          : (r.attempt_count ?? 0) > 0
                            ? 'Failed ❌'
                            : 'Pending'
                    const offlineStatusStyle =
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
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${offlineStatusStyle}`}>
                            {offlineStatusLabel}
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
                              onClick={() => void (async () => {
                                await offlineDelete(r.id)
                                await refreshOffline()
                              })()}
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
      </CollapsibleReportSection>

      <CollapsibleReportSection
        sectionId="submitted"
        title="Submitted reports"
        subtitle="Submitted, in review, or rejected — awaiting approval or follow-up"
        badge={submittedReports.length}
        open={openSubmitted}
        onToggle={() => setOpenSubmitted((v) => !v)}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">Loading reports…</div>
        ) : (
          renderReportTable(
            submittedReports,
            'No reports in this stage. Submitted and in-review inspections appear here.',
          )
        )}
      </CollapsibleReportSection>

      <CollapsibleReportSection
        sectionId="approved"
        title="Approved reports"
        subtitle="Signed-off inspections with a shareable client link when available"
        badge={approvedReports.length}
        open={openApproved}
        onToggle={() => setOpenApproved((v) => !v)}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">Loading reports…</div>
        ) : (
          renderReportTable(approvedReports, 'No approved reports yet.')
        )}
      </CollapsibleReportSection>

      {canMergeReports && (
        <CollapsibleReportSection
          sectionId="merged"
          title="Merged reports"
          subtitle="Previously merged PDFs"
          badge={mergedReports.length}
          open={openMerged}
          onToggle={() => setOpenMerged((v) => !v)}
          headerAside={loadingMerged ? <span className="text-xs text-slate-500">Loading…</span> : null}
        >
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
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(m.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={mergedReportViewHref(m)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
                          >
                            View
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleDownloadMergedPdf(m.id)}
                            disabled={downloadingKey === `merged:${m.id}`}
                            className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
                          >
                            {downloadingKey === `merged:${m.id}` ? `Downloading ${progressLabel}` : 'Download'}
                          </button>
                          {m.pdf_url ? (
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(m.pdf_url!).then(() => {
                                  toast.success('Client link copied')
                                })
                              }}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              Copy client link
                            </button>
                          ) : null}
                          {canDeleteMergedReports ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteMergedReport(m.id)}
                              disabled={deletingMergedId === m.id}
                              className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingMergedId === m.id ? 'Deleting…' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleReportSection>
      )}

      {canMergeReports && (
        <CollapsibleReportSection
          sectionId="deleted-merged"
          title="Recently deleted merged reports"
          subtitle="Soft-deleted reports stay recoverable until permanently purged (typically 30+ days)"
          badge={mergedDeletedReports.length}
          open={openDeletedMerged}
          onToggle={() => setOpenDeletedMerged((v) => !v)}
          variant="amber"
        >
          {mergedDeletedReports.length === 0 ? (
            <div className="border-t border-amber-100 bg-white px-4 py-6 text-sm text-slate-600">
              No recently deleted merged reports.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-amber-100 bg-white">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="px-4 py-3 font-semibold text-slate-700">Client</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Deleted</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedDeletedReports.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{m.client_name}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(m.deleted_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={restoringMergedId === m.id}
                          onClick={() => {
                            void (async () => {
                              setRestoringMergedId(m.id)
                              try {
                                await restoreMergedReportById(m.id)
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Restore failed')
                              } finally {
                                setRestoringMergedId(null)
                              }
                            })()
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {restoringMergedId === m.id ? (
                            <span
                              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent"
                              aria-hidden
                            />
                          ) : null}
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleReportSection>
      )}
    </div>
  )
}
