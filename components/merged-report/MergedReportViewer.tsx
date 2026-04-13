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
      <div className="mx-auto max-w-5xl px-6 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          This document summarises the inspection findings for your facility.
        </p>
        <div className="mt-3 text-sm text-gray-600">
          Prepared for{' '}
          <span className="font-medium text-gray-900">{preparedFor}</span>
        </div>
        <div className="mt-4">
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

      <div className="flex min-h-0 flex-1 flex-col bg-gray-100 py-6">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-6">
          <div className="relative w-full min-h-[31.25rem] h-[min(85vh,56rem)] overflow-hidden rounded-xl bg-gray-100 shadow-sm">
            {mounted ? <PdfViewer fileUrl={pdfSrc} title={title} /> : <LoadingPlaceholder />}
          </div>
        </div>
      </div>
    </ClientReportChrome>
  )
}
