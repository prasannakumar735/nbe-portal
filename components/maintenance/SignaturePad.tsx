'use client'

import { useEffect, useRef, useState } from 'react'

type SignaturePadProps = {
  value: string
  onChange: (dataUrl: string) => void
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    if (!value || !canvasRef.current) return
    const image = new Image()
    image.onload = () => {
      const context = canvasRef.current?.getContext('2d')
      if (!context || !canvasRef.current) return
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      context.drawImage(image, 0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    image.src = value
  }, [value])

  const getPoint = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ('touches' in event && event.touches[0]) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top,
      }
    }

    if ('clientX' in event) {
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }

    return { x: 0, y: 0 }
  }

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const point = getPoint(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.lineWidth = 2
    context.lineCap = 'round'
    context.strokeStyle = '#0f172a'
    setDrawing(true)
  }

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const stopDrawing = () => {
    if (!drawing || !canvasRef.current) return
    setDrawing(false)
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  const clear = () => {
    if (!canvasRef.current) return
    const context = canvasRef.current.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    onChange('')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={800}
        height={220}
        className="w-full rounded-xl border border-slate-300 bg-white"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <button
        type="button"
        onClick={clear}
        className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
      >
        Clear Signature
      </button>
    </div>
  )
}
