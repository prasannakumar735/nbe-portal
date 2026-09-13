'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { ClientReportChrome } from '@/components/merged-report/ClientReportChrome'

const LOADING_LABEL = 'Loading report...'

function LoadingPlaceholder() {
  return (
    <div
      className="flex h-full min-h-[31.25rem] flex-col items-center justify-center gap-3 bg-white px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700"
        aria-hidden
      />
      <p className="text-sm text-gray-500">{LOADING_LABEL}</p>
    </div>
  )
}

const PdfViewer = dynamic(() => import('@/components/report/PdfViewer'), {
  ssr: false,
  loading: () => <LoadingPlaceholder />,
})

/**
 * PDF is rendered only after mount via a client-only PdfViewer (dynamic import, ssr: false)
 * so the server HTML and the client’s first paint stay identical — no hydration mismatch.
 */
export function MergedReportViewer({
  pdfSrc,
  preparedFor,
  title = 'Maintenance Inspection Report Summary',
}: {
  pdfSrc: string
  preparedFor: string
  title?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <ClientReportChrome>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-0 py-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          {/* Header: NBE logo + title */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/NBE_LOGO_BK_PL.png"
              alt="NBE Australia"
              className="h-10 w-auto object-contain"
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
              <p className="text-xs text-slate-500">Maintenance Inspection System</p>
            </div>
          </div>

          {/* Body */}
          <div className="mt-4 space-y-1">
            <p className="text-sm text-slate-600">
              This report summarises the inspection findings for your facility.
            </p>
            <p className="text-sm text-slate-600">
              Prepared for{' '}
              <span className="font-semibold text-slate-900">{preparedFor}</span>
            </p>
          </div>

          <div className="mt-5">
            <a
              href={pdfSrc}
              download="maintenance-inspection-report.pdf"
              className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              <span aria-hidden>⬇</span>
              Download PDF
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* On mobile: height is content-driven (iframe + buttons). On desktop: fixed viewport slot. */}
          <div className="relative md:min-h-[31.25rem] md:h-[min(85vh,56rem)] overflow-hidden rounded-xl bg-slate-100">
            {mounted ? (
              <PdfViewer fileUrl={pdfSrc} title={title} />
            ) : (
              <LoadingPlaceholder />
            )}
          </div>
        </div>
      </div>
    </ClientReportChrome>
  )
}
