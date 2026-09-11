'use client'

import { useEffect, useMemo, useState } from 'react'

function embedPdfUrl(href: string): string {
  const base = href.includes('#') ? href.slice(0, href.indexOf('#')) : href
  return `${base}#toolbar=1&navpanes=1&scrollbar=1`
}

type PdfViewerProps = {
  fileUrl: string
  title: string
}

/**
 * Client-only PDF embed. Do not import this from Server Components without `dynamic({ ssr: false })`.
 *
 * Mobile note: iOS Safari and some Android browsers do not fire onLoad for PDF
 * iframes and cannot render PDFs inline. We hide the spinner after 3 s regardless,
 * and on narrow viewports we show a full-screen open/download prompt instead.
 */
export default function PdfViewer({ fileUrl, title }: PdfViewerProps) {
  const iframeSrc = useMemo(() => embedPdfUrl(fileUrl), [fileUrl])
  const [loaded, setLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    // Fallback: mobile browsers often never fire onLoad for PDF iframes
    const t = setTimeout(() => setLoaded(true), 3000)
    return () => clearTimeout(t)
  }, [])

  if (isMobile) {
    // Google Docs viewer renders PDFs as HTML — works on all mobile browsers
    // without triggering a download. Falls back to direct open if URL is not public.
    const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-white">
        <iframe
          title={title}
          src={googleDocsUrl}
          className="h-full min-h-[70vh] w-full border-0"
          allow="fullscreen"
        />
        <div className="flex justify-center gap-4 border-t border-slate-100 px-6 py-4">
          <a
            href={fileUrl}
            download="maintenance-inspection-report.pdf"
            className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            <span aria-hidden>⬇</span>
            Download PDF
          </a>
        </div>
      </div>
    )
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
