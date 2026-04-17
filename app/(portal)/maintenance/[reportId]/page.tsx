'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/providers/AuthProvider'
import { createSupabaseClient } from '@/lib/supabase/client'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { formatOfflineSaveStatus, useOfflineReport } from '@/hooks/useOfflineReport'
import { MaintenanceInspectionForm } from '../new/page'

export default function MaintenanceReportEditPage() {
  const params = useParams()
  const router = useRouter()
  const { session, profile } = useAuth()
  const reportId = typeof params.reportId === 'string' ? params.reportId : null

  const [authGate, setAuthGate] = useState<'loading' | 'ready' | 'denied'>('loading')
  const [isManagerView, setIsManagerView] = useState(false)

  const loadRole = useCallback(async () => {
    if (!reportId) {
      setAuthGate('ready')
      return
    }
    const user = session?.user
    if (!user?.id) {
      setAuthGate('denied')
      return
    }

    const supabase = createSupabaseClient()
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profileData as { role?: string } | null)?.role
    setIsManagerView(role === 'admin' || role === 'manager')
    setAuthGate('ready')
  }, [reportId, session?.user])

  useEffect(() => {
    void loadRole()
  }, [loadRole])

  const offline = useOfflineReport(authGate === 'ready' && reportId ? reportId : null)

  const initialReportMerged = useMemo(() => {
    if (!offline.initialReportRecord) return null
    return {
      ...offline.initialReportRecord,
      status: offline.reportStatus ?? 'draft',
    }
  }, [offline.initialReportRecord, offline.reportStatus])

  /** Stable identity — a new object each render retriggered the form `watch` → offline persist effect and caused input jank + draft GET storms. */
  const offlineMirrorStable = useMemo(
    () => ({ onPersist: offline.persistForm }),
    [offline.persistForm],
  )

  const accessError = useMemo(() => {
    if (offline.status !== 'ready' || !offline.reportStatus) return null
    const st = offline.reportStatus
    if (isManagerView) {
      if (!['draft', 'submitted', 'reviewing', 'approved'].includes(st)) {
        return 'This report cannot be edited.'
      }
    }
    return null
  }, [offline.status, offline.reportStatus, isManagerView])

  const canApprove = canApproveMaintenanceReport(profile ?? undefined)

  const loading = authGate === 'loading' || offline.status === 'loading'
  const error =
    authGate === 'denied'
      ? 'Sign in required.'
      : offline.status === 'error'
        ? 'Report not found or unable to load.'
        : accessError

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

  if (!initialReportMerged || !reportId) {
    return null
  }

  return (
    <div className="relative">
      {offline.conflict ? (
        <div className="mx-auto mb-4 w-full max-w-screen-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Sync conflict</p>
          <p className="mt-1">{offline.conflict.message}</p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-amber-950 underline"
            onClick={() => void offline.resolveConflictRefresh()}
          >
            Reload server copy and continue
          </button>
        </div>
      ) : null}

      <MaintenanceInspectionForm
        reportIdFromRoute={reportId}
        initialReport={initialReportMerged}
        isAdminMode={isManagerView}
        serverReportStatus={offline.reportStatus}
        onApproved={() => router.push('/maintenance')}
        hydrateOnlyFromInitialReport
        offlineMirror={offlineMirrorStable}
        offlineSaveStatusLabel={formatOfflineSaveStatus(offline.saveStatus)}
      />
    </div>
  )
}
