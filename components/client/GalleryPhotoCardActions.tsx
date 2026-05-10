'use client'

import { Download, ExternalLink } from 'lucide-react'

export function GalleryPhotoCardActions({
  viewHref,
  downloadHref,
}: {
  viewHref: string
  downloadHref: string
}) {
  return (
    <div className="mt-2 flex items-center justify-end gap-1">
      <a
        href={viewHref}
        target="_blank"
        rel="noopener noreferrer"
        title="Open full size"
        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only">Open full size in a new tab</span>
      </a>
      <a
        href={downloadHref}
        target="_blank"
        rel="noopener noreferrer"
        title="Download image"
        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only">Download this image</span>
      </a>
    </div>
  )
}
