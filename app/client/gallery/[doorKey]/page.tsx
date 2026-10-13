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

  // Skip the date picker when there's only one visit — go straight to photos
  if (visits.length === 1) {
    const v = visits[0]!
    redirect(
      `/client/gallery/${encodeURIComponent(doorKey)}/${encodeURIComponent(v.reportId)}?doorRow=${encodeURIComponent(v.maintenanceDoorRowId)}`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Photo gallery</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{folder.folderTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">Select an inspection date to view photos from that visit.</p>
        </div>
        <ClientPortalBackLink href="/client/gallery" label="All doors" />
      </div>

      {visits.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No approved visits with client-shared reports are linked to this door yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visits.map(v => (
            <li key={v.reportId}>
              <Link
                href={`/client/gallery/${encodeURIComponent(doorKey)}/${encodeURIComponent(v.reportId)}?doorRow=${encodeURIComponent(v.maintenanceDoorRowId)}`}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-500 group-hover:bg-sky-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{formatPortalDisplayDateYmd(v.displayDate)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">View photos</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
