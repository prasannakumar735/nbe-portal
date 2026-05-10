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
            <p className="mt-2 text-xs font-medium text-slate-600">
              Site filter: <span className="text-slate-900">{session.portalLocationLabel}</span>
            </p>
          ) : null}
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Inspection records are organised by door and visit date. Select a folder to view inspection photos, and hover for
            additional site and door information.
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map(f => (
            <li key={`${f.keyType}-${f.key}`}>
              <Link
                href={`/client/gallery/${encodeURIComponent(f.key)}`}
                title={f.hoverLines.join('\n')}
                className="flex flex-col items-center rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-white px-4 py-8 text-center shadow-sm transition hover:border-amber-300 hover:shadow-md"
              >
                <span className="text-4xl" aria-hidden>
                  📁
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-900">{f.folderTitle}</span>
                <span className="mt-1 text-xs text-slate-500">Open visits</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
