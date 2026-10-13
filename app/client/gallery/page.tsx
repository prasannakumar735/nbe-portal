import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClientPortalBackLink } from '@/components/client/ClientPortalNavControls'
import { getClientPortalSession } from '@/lib/client-portal/getClientPortalSession'
import { fetchClientGalleryDoorFolders } from '@/lib/client-portal/clientMaintenancePortal'

export default async function ClientGalleryPage() {
  const session = await getClientPortalSession()

  if (!session.ok) {
    if (session.reason === 'not_client') {
      redirect('/dashboard')
    }
    redirect('/login?next=/client/gallery')
  }

  const folders = await fetchClientGalleryDoorFolders(session.clientId, session.portalLocationId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Photo gallery</h1>
          {session.portalLocationLabel ? (
            <p className="mt-1 text-xs font-medium text-slate-500">
              Site: <span className="text-slate-700">{session.portalLocationLabel}</span>
            </p>
          ) : null}
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Inspection photos organised by door. Select a door to view visit photos.
          </p>
        </div>
        <ClientPortalBackLink href="/client" label="Dashboard" />
      </div>

      {folders.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No doors or inspection photos are linked to your locations yet. Photos appear here after doors are registered
          or captured on approved maintenance reports.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map(f => (
            <li key={`${f.keyType}-${f.key}`}>
              <Link
                href={`/client/gallery/${encodeURIComponent(f.key)}`}
                title={f.hoverLines.join('\n')}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 group-hover:bg-amber-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{f.folderTitle}</p>
                  <p className="mt-0.5 text-xs text-slate-400">View inspection photos</p>
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
