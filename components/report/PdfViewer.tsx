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
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 bg-white px-6 py-10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <p className="text-center text-sm text-slate-600">
          Tap below to open or download the report PDF.
        </p>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          <span aria-hidden>📄</span>
          Open Report PDF
        </a>
        <a
          href={fileUrl}
          download="maintenance-inspection-report.pdf"
          className="text-sm text-slate-500 underline underline-offset-2"
        >
          Download instead
        </a>
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
