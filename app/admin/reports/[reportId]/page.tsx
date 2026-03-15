'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MaintenanceInspectionForm } from '@/app/(portal)/maintenance/new/page'

export default function AdminReportEditPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = typeof params.reportId === 'string' ? params.reportId : null

  const [initialReport, setInitialReport] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    if (!reportId) {
      router.replace('/admin/reports')
      return
    }

    const res = await fetch(`/api/maintenance/draft?reportId=${encodeURIComponent(reportId)}`)
    const data = await res.json()

    if (!res.ok || !data.report) {
      setError('Report not found or unable to load.')
      setLoading(false)
      return
    }

    const status = data.report.status
    if (status !== 'submitted' && status !== 'reviewing') {
      setError('Only submitted or reviewing reports can be edited here.')
      setLoading(false)
      return
    }

    setInitialReport(data.report)
    setLoading(false)
  }, [reportId, router])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-md px-4 py-8">
        <p className="text-slate-600">Loading report…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-screen-md px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
        <a href="/admin/reports" className="mt-4 inline-block text-slate-600 underline">
          Back to admin reports
        </a>
      </div>
    )
  }

  if (!initialReport || !reportId) {
    return null
  }

  return (
    <MaintenanceInspectionForm
      reportIdFromRoute={reportId}
      initialReport={initialReport}
      isAdminMode
    />
  )
}
