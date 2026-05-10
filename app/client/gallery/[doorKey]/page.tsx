import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ClientPortalBackLink } from '@/components/client/ClientPortalNavControls'
import { getClientPortalSession } from '@/lib/client-portal/getClientPortalSession'
import {
  fetchDoorGalleryVisits,
  formatPortalDisplayDateYmd,
  resolveClientGalleryFolder,
} from '@/lib/client-portal/clientMaintenancePortal'

type PageProps = {
  params: Promise<{ doorKey: string }>
}

export default async function ClientGalleryDoorPage({ params }: PageProps) {
  const session = await getClientPortalSession()

  if (!session.ok) {
    if (session.reason === 'not_client') {
      redirect('/dashboard')
    }
    const { doorKey } = await params
    redirect(`/login?next=${encodeURIComponent(`/client/gallery/${doorKey}`)}`)
  }

  const { doorKey: rawKey } = await params
  const doorKey = decodeURIComponent(String(rawKey ?? '').trim())
  if (!doorKey) {
    notFound()
  }

  const folder = await resolveClientGalleryFolder(session.clientId, doorKey, session.portalLocationId)
  if (!folder) {
    notFound()
  }

  const visits = await fetchDoorGalleryVisits(session.clientId, folder, session.portalLocationId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Door</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{folder.folderTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">Choose an inspection date to view photos from that visit.</p>
        </div>
        <ClientPortalBackLink href="/client/gallery" label="All doors" />
      </div>

      {visits.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No approved visits with client-shared reports are linked to this door yet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visits.map(v => (
            <li key={v.reportId}>
              <Link
                href={`/client/gallery/${encodeURIComponent(doorKey)}/${encodeURIComponent(v.reportId)}?doorRow=${encodeURIComponent(v.maintenanceDoorRowId)}`}
                className="flex flex-col items-center rounded-xl border border-sky-200/80 bg-gradient-to-b from-sky-50 to-white px-4 py-8 text-center shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <span className="text-4xl" aria-hidden>
                  📁
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-900">
                  {formatPortalDisplayDateYmd(v.displayDate)}
                </span>
                <span className="mt-1 text-xs text-slate-500">View photos</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
