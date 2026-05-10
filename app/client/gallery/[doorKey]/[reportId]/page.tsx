import { redirect, notFound } from 'next/navigation'
import { GalleryPhotoCardActions } from '@/components/client/GalleryPhotoCardActions'
import { ClientPortalOutlineNavButton, ClientPortalZipDownloadButton } from '@/components/client/ClientPortalNavControls'
import { getClientPortalSession } from '@/lib/client-portal/getClientPortalSession'
import {
  fetchGalleryPhotoIdsForVisit,
  formatPortalDisplayDateYmd,
  resolveClientGalleryFolder,
  fetchDoorGalleryVisits,
} from '@/lib/client-portal/clientMaintenancePortal'

type PageProps = {
  params: Promise<{ doorKey: string; reportId: string }>
  searchParams: Promise<{ doorRow?: string }>
}

export default async function ClientGalleryPhotosPage({ params, searchParams }: PageProps) {
  const session = await getClientPortalSession()

  if (!session.ok) {
    if (session.reason === 'not_client') {
      redirect('/dashboard')
    }
    const [{ doorKey, reportId }, sp] = await Promise.all([params, searchParams])
    redirect(
      `/login?next=${encodeURIComponent(`/client/gallery/${doorKey}/${reportId}?doorRow=${encodeURIComponent(sp.doorRow ?? '')}`)}`,
    )
  }

  const [{ doorKey: rawDoorKey, reportId: rawReportId }, sp] = await Promise.all([params, searchParams])

  const doorKey = decodeURIComponent(String(rawDoorKey ?? '').trim())
  const reportId = decodeURIComponent(String(rawReportId ?? '').trim())
  const doorRow = String(sp.doorRow ?? '').trim()

  if (!doorKey || !reportId || !doorRow) {
    notFound()
  }

  const folder = await resolveClientGalleryFolder(session.clientId, doorKey, session.portalLocationId)
  if (!folder) {
    notFound()
  }

  const visits = await fetchDoorGalleryVisits(session.clientId, folder, session.portalLocationId)
  const visit = visits.find(v => v.reportId === reportId && v.maintenanceDoorRowId === doorRow)
  if (!visit) {
    notFound()
  }

  const photoIds = await fetchGalleryPhotoIdsForVisit(
    session.clientId,
    reportId,
    doorRow,
    session.portalLocationId,
  )
  if (photoIds === null) {
    notFound()
  }

  const zipHref = `/api/client/maintenance-photos/${encodeURIComponent(reportId)}/zip?doorRows=${encodeURIComponent(doorRow)}`

  const proxiedSrc = (photoId: string) =>
    `/api/client/maintenance-photos/${encodeURIComponent(reportId)}/image/${encodeURIComponent(photoId)}`

  const proxiedDownload = (photoId: string) => `${proxiedSrc(photoId)}?download=1`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {folder.folderTitle} · {formatPortalDisplayDateYmd(visit.displayDate)}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Inspection photos</h1>
          <div className="mt-1 max-w-2xl space-y-2 text-sm leading-relaxed text-slate-600">
            <p>View the inspection images captured during this service visit.</p>
            <p>Select an image to view it in full size or download individual photos as needed.</p>
            {photoIds.length > 0 ? (
              <p>
                Use <span className="font-medium text-slate-800">Download ZIP</span> to save all photos from this
                inspection in a single file.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ClientPortalOutlineNavButton href={`/client/gallery/${encodeURIComponent(doorKey)}`} label="Dates" />
          {photoIds.length > 0 ? <ClientPortalZipDownloadButton href={zipHref} /> : null}
        </div>
      </div>

      {photoIds.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No photos were uploaded for this door on this report.
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {photoIds.map((photoId, i) => (
            <li key={photoId} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <a
                href={proxiedSrc(photoId)}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- proxied same-origin API */}
                <img
                  src={proxiedSrc(photoId)}
                  alt={`Inspection photo ${i + 1}`}
                  className="mx-auto max-h-[min(70vh,520px)] w-auto object-contain"
                />
              </a>
              <GalleryPhotoCardActions viewHref={proxiedSrc(photoId)} downloadHref={proxiedDownload(photoId)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
