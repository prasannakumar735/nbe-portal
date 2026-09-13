'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  fileUrl: string
  title: string
}

type PdfjsLib = typeof import('pdfjs-dist')
type PdfDocumentProxy = Awaited<ReturnType<PdfjsLib['getDocument']>['promise']>

/**
 * Mobile PDF viewer using PDF.js.
 * Renders each page as a canvas element scaled to fit the screen width.
 * Fully scrollable and readable on iOS Safari and Android Chrome.
 */
export default function MobilePdfViewer({ fileUrl, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const pdfRef = useRef<PdfDocumentProxy | null>(null)
  const renderingRef = useRef(false)
  const canvasesRef = useRef<HTMLCanvasElement[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setError('')

        const pdfjsLib = await import('pdfjs-dist')
        // Worker must match the installed version exactly
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const pdf = await pdfjsLib.getDocument({ url: fileUrl, withCredentials: false }).promise
        if (cancelled) return

        pdfRef.current = pdf
        setNumPages(pdf.numPages)
        setLoading(false)
        renderAllPages(pdf, pdfjsLib)
      } catch (err) {
        if (!cancelled) {
          setError('Unable to load the PDF. Try using the download button below.')
          setLoading(false)
        }
      }
    }

    async function renderAllPages(pdf: PdfDocumentProxy, pdfjsLib: PdfjsLib) {
      if (renderingRef.current) return
      renderingRef.current = true

      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
      // Render only visible page and a couple around it to save memory
      const pagesToRender = pdf.numPages

      for (let i = 1; i <= pagesToRender; i++) {
        if (cancelled) break
        const canvas = canvasesRef.current[i - 1]
        if (!canvas) continue

        try {
          const page = await pdf.getPage(i)
          if (cancelled) break

          const viewport = page.getViewport({ scale: 1 })
          const scale = containerWidth / viewport.width
          const scaledViewport = page.getViewport({ scale })

          canvas.width = scaledViewport.width
          canvas.height = scaledViewport.height
          canvas.style.width = '100%'
          canvas.style.height = 'auto'

          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
        } catch {
          // skip failed page
        }
      }

      renderingRef.current = false
    }

    loadPdf()
    return () => { cancelled = true }
  }, [fileUrl])

  // Track which page is visible for the page counter
  useEffect(() => {
    const canvases = canvasesRef.current
    if (!canvases.length) return
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = canvases.indexOf(entry.target as HTMLCanvasElement)
            if (idx !== -1) setCurrentPage(idx + 1)
          }
        }
      },
      { threshold: 0.5 },
    )
    canvases.forEach(c => c && observer.observe(c))
    return () => observer.disconnect()
  }, [numPages])

  return (
    <div className="flex w-full flex-col bg-white">
      {/* Page counter header */}
      {numPages > 0 && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <span className="text-xs text-slate-500">{title}</span>
          <span className="text-xs font-medium text-slate-600">
            Page {currentPage} of {numPages}
          </span>
        </div>
      )}

      {/* PDF canvas pages */}
      <div ref={containerRef} className="w-full overflow-y-auto bg-slate-100" style={{ maxHeight: '70vh' }}>
        {loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="text-sm text-slate-500">Loading report…</p>
          </div>
        )}

        {error && (
          <div className="flex h-48 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        )}

        {!error && Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="mb-2 last:mb-0 shadow-sm">
            <canvas
              ref={el => { if (el) canvasesRef.current[i] = el }}
              className="block w-full"
              aria-label={`Page ${i + 1}`}
            />
          </div>
        ))}
      </div>

      {/* Download fallback */}
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4">
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
