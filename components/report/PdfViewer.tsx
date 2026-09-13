'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'

function embedPdfUrl(href: string): string {
  const base = href.includes('#') ? href.slice(0, href.indexOf('#')) : href
  return `${base}#toolbar=1&navpanes=1&scrollbar=1`
}

const MobilePdfViewer = dynamic(() => import('./MobilePdfViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 flex-col items-center justify-center gap-3 bg-white">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      <p className="text-sm text-slate-500">Loading report…</p>
    </div>
  ),
})

type PdfViewerProps = {
  fileUrl: string
  title: string
}

/**
 * Client-only PDF embed. Do not import this from Server Components without `dynamic({ ssr: false })`.
 *
 * Mobile: PDF.js renders each page as a canvas scaled to screen width — fully
 *   scrollable and readable on iOS Safari and Android Chrome.
 * Desktop: full-screen iframe embed with a loading spinner.
 */
export default function PdfViewer({ fileUrl, title }: PdfViewerProps) {
  const iframeSrc = useMemo(() => embedPdfUrl(fileUrl), [fileUrl])
  const [loaded, setLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const t = setTimeout(() => setLoaded(true), 4000)
    return () => clearTimeout(t)
  }, [])

  if (isMobile) {
    return <MobilePdfViewer fileUrl={fileUrl} title={title} />
  }

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
