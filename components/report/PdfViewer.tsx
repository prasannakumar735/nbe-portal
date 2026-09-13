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
 * Mobile: iOS Safari can render PDFs inside an <iframe> using its native viewer.
 * We show the iframe with a download button below it as a universal fallback.
 * Desktop: full-screen iframe embed with a loading spinner.
 */
export default function PdfViewer({ fileUrl, title }: PdfViewerProps) {
  const iframeSrc = useMemo(() => embedPdfUrl(fileUrl), [fileUrl])
  const [loaded, setLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    // Mobile browsers may not fire onLoad for PDF iframes — hide spinner after 4 s
    const t = setTimeout(() => setLoaded(true), 4000)
    return () => clearTimeout(t)
  }, [])

  if (isMobile) {
    // iOS Safari renders PDF iframes natively via its built-in viewer.
    // Show the iframe at a fixed viewport height + a download button below as fallback.
    return (
      <div className="flex w-full flex-col bg-white">
        <iframe
          title={title}
          src={fileUrl}
          className="w-full border-0"
          style={{ height: '70vh', minHeight: '400px' }}
          allow="fullscreen"
        />
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5">
          <p className="text-center text-xs text-slate-400">If the PDF does not display above, use the buttons below.</p>
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
