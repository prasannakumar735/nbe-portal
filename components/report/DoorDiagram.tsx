'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import doorDiagramDefault from '@/app/door/door_image_reports.png'

export { DOOR_DIAGRAM_LEGEND, DOOR_DIAGRAM_LEGEND_ITEMS } from '@/lib/maintenance/doorDiagramLegend'

type DoorDiagramProps = {
  src?: string | null
  alt?: string
}

/** Full-screen lightbox with pinch-to-zoom and double-tap zoom. */
function DiagramLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const lastTap = useRef(0)
  const lastPinchDist = useRef<number | null>(null)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function pinchDist(e: React.TouchEvent) {
    const [a, b] = [e.touches[0]!, e.touches[1]!]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      lastPinchDist.current = pinchDist(e)
      return
    }
    // Double-tap to toggle zoom
    const now = Date.now()
    if (now - lastTap.current < 300) {
      setScale(s => s > 1 ? 1 : 2.5)
      setOffset({ x: 0, y: 0 })
    }
    lastTap.current = now
    // Start drag
    dragStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, ox: offset.x, oy: offset.y }
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dist = pinchDist(e)
      const ratio = dist / lastPinchDist.current
      setScale(s => Math.min(5, Math.max(1, s * ratio)))
      lastPinchDist.current = dist
      return
    }
    if (dragStart.current && scale > 1) {
      const dx = e.touches[0]!.clientX - dragStart.current.x
      const dy = e.touches[0]!.clientY - dragStart.current.y
      setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
    }
  }

  function handleTouchEnd() {
    lastPinchDist.current = null
    dragStart.current = null
    if (scale <= 1) setOffset({ x: 0, y: 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={() => { if (scale <= 1) onClose() }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Hint */}
      {scale === 1 && (
        <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-white/50">
          Pinch or double-tap to zoom
        </p>
      )}

      {/* Image */}
      <div
        className="relative h-full w-full touch-none select-none"
        style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`, transition: scale === 1 ? 'transform 0.2s' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={e => e.stopPropagation()}
      >
        <Image src={src} alt={alt} fill className="object-contain" sizes="100vw" priority />
      </div>
    </div>
  )
}

/** Full-width door diagram slot. Tap to open fullscreen lightbox on mobile. */
export function DoorDiagram({ src, alt = 'Door layout diagram' }: DoorDiagramProps) {
  const resolvedSrc = src ?? doorDiagramDefault.src
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const breakAvoid = {
    pageBreakInside: 'avoid' as const,
    breakInside: 'avoid' as const,
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm" style={breakAvoid}>
        <h2 className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Door Diagram</h2>
        <div
          className="relative mx-2 mb-2 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 md:mx-4 md:mb-4 md:h-[520px] md:[aspect-ratio:unset]"
          style={{ ...breakAvoid, aspectRatio: '1600/1185' }}
        >
          {resolvedSrc ? (
            <>
              <div className="relative h-full w-full">
                <Image
                  src={resolvedSrc}
                  alt={alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 672px"
                  priority={false}
                />
              </div>
              {/* Tap-to-expand overlay — mobile only */}
              <button
                className="absolute inset-0 flex items-end justify-end p-2 md:hidden"
                onClick={() => setLightboxOpen(true)}
                aria-label="View fullscreen"
              >
                <span className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                  Expand
                </span>
              </button>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-200 bg-white px-2 text-center text-sm text-slate-400">
              Diagram appears on PDF when configured for this report type.
            </div>
          )}
        </div>
      </section>

      {lightboxOpen && resolvedSrc && (
        <DiagramLightbox src={resolvedSrc} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  )
}
