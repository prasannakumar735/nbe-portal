'use client'

import { useMemo, useState } from 'react'

function embedPdfUrl(href: string): string {
  const base = href.includes('#') ? href.slice(0, href.indexOf('#')) : href
  // toolbar=1 keeps the browser PDF controls visible (Chrome/Edge/Firefox)
  return `${base}#toolbar=1&navpanes=1&scrollbar=1`
}

type PdfViewerProps = {
  fileUrl: string
  title: string
}

/**
 * Client-only PDF embed. Do not import this from Server Components without `dynamic({ ssr: false })`.
 */
export default function PdfViewer({ fileUrl, title }: PdfViewerProps) {
  const iframeSrc = useMemo(() => embedPdfUrl(fileUrl), [fileUrl])
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative h-full min-h-0 w-full bg-gray-100">
      {!loaded ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white"
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700"
            aria-hidden
          />
          <p className="text-sm text-gray-500">Loading report...</p>
        </div>
      ) : null}
      <iframe
        title={title}
        src={iframeSrc}
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full border-0 bg-gray-100"
      />
    </div>
  )
}
