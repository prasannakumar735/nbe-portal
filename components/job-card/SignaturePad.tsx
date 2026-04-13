'use client'

import { useCallback, useRef, useState } from 'react'

type Props = {
  className?: string
  onCapture?: (blob: Blob) => void
  disabled?: boolean
}

export function SignaturePad({ className, onCapture, disabled }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const c = ref.current
    if (!c) return
    c.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = c.getContext('2d')
    if (!ctx) return
    const p = pos(e)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasInk(true)
  }

  const endStroke = () => {
    drawing.current = false
  }

  const clear = useCallback(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
  }, [])

  const capturePng = useCallback(async () => {
    const c = ref.current
    if (!c || !hasInk) return
    await new Promise<void>(resolve => {
      c.toBlob(
        blob => {
          if (blob && onCapture) onCapture(blob)
          resolve()
        },
        'image/png',
        0.92,
      )
    })
  }, [hasInk, onCapture])

  return (
    <div className={className}>
      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <canvas
          ref={ref}
          width={320}
          height={160}
          className="mx-auto block max-w-full touch-none rounded-lg bg-gray-50"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void capturePng()}
            disabled={disabled || !hasInk}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use signature
          </button>
        </div>
      </div>
    </div>
  )
}
