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
    // iOS Safari and most mobile browsers cannot render PDF iframes inline.
    // Show a clear open/download prompt instead.
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-6 bg-white px-6 py-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-slate-500">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-slate-800">PDF report ready</p>
          <p className="mt-1 text-sm text-slate-500">Tap below to open or download your report.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Open PDF
          </a>
          <a
            href={fileUrl}
            download="maintenance-inspection-report.pdf"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
