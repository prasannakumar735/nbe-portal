import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getClientPortalSession } from '@/lib/client-portal/getClientPortalSession'
import {
  fetchClientPortalMergedReports,
  fetchClientPortalSingleReports,
  groupPortalReportsByDate,
} from '@/lib/client-portal/clientMaintenancePortal'
import { ClientPortalReportSections } from '@/components/client/ClientPortalReportSections'

export default async function ClientPortalHomePage() {
  const session = await getClientPortalSession()

  if (!session.ok && session.reason === 'not_client') {
    redirect('/dashboard')
  }

  if (!session.ok) {
    redirect('/login?next=/client')
  }

  const singles = await fetchClientPortalSingleReports(session.clientId, session.portalLocationId)
  const merged = await fetchClientPortalMergedReports(session.clientId, session.portalLocationId)
  const grouped = groupPortalReportsByDate([...singles, ...merged])
  const sections = [...grouped.entries()].map(([dateYmd, entries]) => ({ dateYmd, entries }))

  return (
    <div className="space-y-10">
 <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
  <h1 className="text-xl font-bold tracking-tight text-slate-900">
    Dashboard
  </h1>

  {session.portalLocationLabel ? (
    <p className="mt-3 inline-flex rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
      Showing site:
      <span className="ml-1 text-slate-900">
        {session.portalLocationLabel}
      </span>
    </p>
  ) : null}

  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
    Access approved maintenance reports, inspection history, and shared
    documentation for your organisation. Browse the complete archive in{" "}
    
    <Link
      href="/client/reports"
      className="font-medium text-indigo-700 transition hover:text-indigo-900"
    >
      Maintenance reports
    </Link>{" "}
    
    or view inspection images in the{" "}
    
    <Link
      href="/client/gallery"
      className="font-medium text-indigo-700 transition hover:text-indigo-900"
    >
      Photo gallery
    </Link>
    .
  </p>
</div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Recent reports</h2>
          <Link
            href="/client/reports"
            className="text-sm font-medium text-indigo-800 underline decoration-indigo-200 underline-offset-2 transition hover:text-indigo-950 hover:decoration-indigo-400"
          >
            View all
          </Link>
        </div>
        <ClientPortalReportSections sections={sections} compact />
      </section>
    </div>
  )
}
