'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
