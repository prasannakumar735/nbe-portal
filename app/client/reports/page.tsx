import { redirect } from 'next/navigation'
import { ClientPortalBackLink } from '@/components/client/ClientPortalNavControls'
import { getClientPortalSession } from '@/lib/client-portal/getClientPortalSession'
import {
  fetchClientPortalMergedReports,
  fetchClientPortalSingleReports,
  groupPortalReportsByDate,
} from '@/lib/client-portal/clientMaintenancePortal'
import { ClientPortalReportSections } from '@/components/client/ClientPortalReportSections'

export default async function ClientMaintenanceReportsPage() {
  const session = await getClientPortalSession()

  if (!session.ok) {
    if (session.reason === 'not_client') {
      redirect('/dashboard')
    }
    redirect('/login?next=/client/reports')
  }

  const singles = await fetchClientPortalSingleReports(session.clientId, session.portalLocationId)
  const merged = await fetchClientPortalMergedReports(session.clientId, session.portalLocationId)
  const grouped = groupPortalReportsByDate([...singles, ...merged])
  const sections = [...grouped.entries()].map(([dateYmd, entries]) => ({ dateYmd, entries }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Maintenance reports</h1>
          {session.portalLocationLabel ? (
            <p className="mt-2 text-xs font-medium text-slate-600">
              Site filter: <span className="text-slate-900">{session.portalLocationLabel}</span>
            </p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            Approved reports shared with your organisation, grouped by inspection date (or summary issue date for merged
            PDFs).
          </p>
        </div>
        <ClientPortalBackLink href="/client" label="Dashboard" />
      </div>

      <ClientPortalReportSections sections={sections} />
    </div>
  )
}
