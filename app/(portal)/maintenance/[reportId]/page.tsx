'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/providers/AuthProvider'
import { createSupabaseClient } from '@/lib/supabase/client'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { MaintenanceInspectionForm } from '../new/page'

export default function MaintenanceReportEditPage() {
  const params = useParams()
  const router = useRouter()
  const { session, profile } = useAuth()
  const reportId = typeof params.reportId === 'string' ? params.reportId : null

  const [initialReport, setInitialReport] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isManagerView, setIsManagerView] = useState(false)

  const canApprove = canApproveMaintenanceReport(profile ?? undefined)

  const loadReport = useCallback(async () => {
    if (!reportId) {
      setLoading(false)
      return
    }

    const user = session?.user
    if (!user?.id) {
      setLoading(false)
      setError('Sign in required.')
      return
    }

    const supabase = createSupabaseClient()
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profileData as { role?: string } | null)?.role
    const managerOrAdmin = role === 'admin' || role === 'manager'
    setIsManagerView(managerOrAdmin)

    const res = await fetch(`/api/maintenance/draft?reportId=${encodeURIComponent(reportId)}`, {
      cache: 'no-store',
    })
    const data = await res.json()

    if (!res.ok || !data.report) {
      setError('Report not found or unable to load.')
      setLoading(false)
      return
    }

    const status = data.report.status as string

    if (managerOrAdmin) {
      if (!['draft', 'submitted', 'reviewing', 'approved'].includes(status)) {
        setError('This report cannot be edited.')
        setLoading(false)
        return
      }
    }

    setInitialReport(data.report)
    setLoading(false)
  }, [reportId, session?.user])

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
        <Link href={canApprove ? '/maintenance' : '/maintenance'} className="mt-4 inline-block text-slate-600 underline">
          Back to maintenance
        </Link>
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
      isAdminMode={isManagerView}
      onApproved={() => router.push('/maintenance')}
    />
  )
}
