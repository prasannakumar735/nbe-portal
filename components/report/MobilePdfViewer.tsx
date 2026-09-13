'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  fileUrl: string
  title: string
}

/**
 * Mobile PDF viewer using PDF.js.
 * Renders each page as a canvas element scaled to fit the screen width.
 * Fully scrollable and readable on iOS Safari and Android Chrome.
 */
export default function MobilePdfViewer({ fileUrl, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasesRef = useRef<(HTMLCanvasElement | null)[]>([])
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // Store the loaded PDF proxy so the render effect can use it
  const pdfRef = useRef<{
    numPages: number
    getPage: (n: number) => Promise<unknown>
  } | null>(null)

  // Step 1: load the PDF document
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError('')

        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const pdf = await pdfjsLib.getDocument({ url: fileUrl, withCredentials: false }).promise
        if (cancelled) return

        pdfRef.current = pdf as typeof pdfRef.current
        // Updating numPages mounts the canvas elements, which triggers Step 2
        setNumPages(pdf.numPages)
      } catch {
        if (!cancelled) {
          setError('Unable to load the PDF. Try the buttons below.')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [fileUrl])

  // Step 2: once canvases are mounted (numPages > 0), render every page
  useEffect(() => {
    if (numPages === 0 || !pdfRef.current) return

    let cancelled = false

    async function renderAll() {
      const pdf = pdfRef.current!
      const containerWidth =
        containerRef.current?.clientWidth ?? window.innerWidth

      for (let i = 1; i <= numPages; i++) {
        if (cancelled) break
        const canvas = canvasesRef.current[i - 1]
        if (!canvas) continue

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const page: any = await pdf.getPage(i)
          if (cancelled) break

          const vp = page.getViewport({ scale: 1 })
          const scale = containerWidth / vp.width
          const scaledVp = page.getViewport({ scale })

          canvas.width = Math.floor(scaledVp.width)
          canvas.height = Math.floor(scaledVp.height)

          const ctx = canvas.getContext('2d')
          if (!ctx || cancelled) continue

          await page.render({ canvas, canvasContext: ctx, viewport: scaledVp }).promise
        } catch {
          // skip bad page silently
        }
      }

      if (!cancelled) setLoading(false)
    }

    renderAll()
    return () => { cancelled = true }
  }, [numPages])

  // Track visible page for the counter
  useEffect(() => {
    if (numPages === 0) return
    const canvases = canvasesRef.current.filter(Boolean) as HTMLCanvasElement[]
    if (!canvases.length) return

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = canvasesRef.current.indexOf(e.target as HTMLCanvasElement)
            if (idx !== -1) setCurrentPage(idx + 1)
          }
        }
      },
      { threshold: 0.4 },
    )
    canvases.forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [numPages])

  return (
    <div className="flex w-full flex-col bg-white">
      {/* Page counter */}
      {numPages > 0 && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-500 truncate pr-2">{title}</span>
          <span className="shrink-0 font-medium text-slate-600">
            {loading ? 'Loading…' : `Page ${currentPage} of ${numPages}`}
          </span>
        </div>
      )}

      {/* Scrollable PDF pages */}
      <div
        ref={containerRef}
        className="w-full overflow-y-auto bg-slate-100"
        style={{ maxHeight: '70vh' }}
      >
        {loading && numPages === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="text-sm text-slate-500">Loading report…</p>
          </div>
        )}

        {error && (
          <div className="flex h-48 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        )}

        {/* Canvases are mounted when numPages is known; content renders in the effect above */}
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="mb-1 last:mb-0 bg-white shadow-sm">
            <canvas
              ref={el => { canvasesRef.current[i] = el }}
              className="block w-full"
              aria-label={`Page ${i + 1}`}
            />
          </div>
        ))}
      </div>

      {/* Open / Download fallback */}
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
