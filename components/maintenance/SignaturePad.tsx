'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type SignaturePadProps = {
  value: string
  onChange: (dataUrl: string) => void
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<'draw' | 'type' | 'upload'>('draw')
  const [hasInk, setHasInk] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [typedStyle, setTypedStyle] = useState<'regular' | 'italic' | 'bold_italic'>('italic')

  const cssSize = useMemo(() => ({ width: 800, height: 220 }), [])

  const syncCanvasScale = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const w = Math.max(1, Math.floor(cssSize.width * dpr))
    const h = Math.max(1, Math.floor(cssSize.height * dpr))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
  }

  const renderTypedSignature = (name: string, style: typeof typedStyle) => {
    const canvas = canvasRef.current
    if (!canvas) return
    syncCanvasScale()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, cssSize.width, cssSize.height)
    const cleaned = String(name ?? '').trim()
    if (!cleaned) {
      setHasInk(false)
      onChange('')
      return
    }
    const fontStyle = style === 'regular' ? 'normal' : 'italic'
    const fontWeight = style === 'bold_italic' ? 700 : 400
    const fontSize = 64
    ctx.fillStyle = '#0f172a'
    ctx.textBaseline = 'middle'
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px Roboto, ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial`

    const maxWidth = cssSize.width - 80
    let size = fontSize
    while (size > 28 && ctx.measureText(cleaned).width > maxWidth) {
      size -= 2
      ctx.font = `${fontStyle} ${fontWeight} ${size}px Roboto, ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial`
    }

    const tw = ctx.measureText(cleaned).width
    const x = (cssSize.width - tw) / 2
    const y = cssSize.height / 2 + 12
    ctx.fillText(cleaned, x, y)
    setHasInk(true)
    onChange(canvas.toDataURL('image/png'))
  }

  useEffect(() => {
    if (!value || !canvasRef.current) return
    syncCanvasScale()
    const image = new Image()
    if (/^https?:\/\//i.test(value)) {
      image.crossOrigin = 'anonymous'
    }
    image.onload = () => {
      const context = canvasRef.current?.getContext('2d')
      if (!context || !canvasRef.current) return
      context.clearRect(0, 0, cssSize.width, cssSize.height)
      context.drawImage(image, 0, 0, cssSize.width, cssSize.height)
      setHasInk(true)
    }
    image.onerror = () => {
      setHasInk(false)
    }
    image.src = value
  }, [value, cssSize.height, cssSize.width])

  useEffect(() => {
    syncCanvasScale()
    const onResize = () => syncCanvasScale()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * cssSize.width
    const y = ((e.clientY - r.top) / r.height) * cssSize.height
    return { x, y }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return
    const c = canvasRef.current
    if (!c) return
    syncCanvasScale()
    c.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const ctx = c.getContext('2d')
    if (!ctx) return
    const p = pos(e)
    lastPointRef.current = p
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || mode !== 'draw') return
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const p = pos(e)
    if (!lastPointRef.current) {
      lastPointRef.current = p
      ctx.moveTo(p.x, p.y)
      return
    }
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastPointRef.current = p
    setHasInk(true)
  }

  const endStroke = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    const c = canvasRef.current
    if (!c) return
    if (hasInk) onChange(c.toDataURL('image/png'))
  }

  const clear = () => {
    if (!canvasRef.current) return
    const context = canvasRef.current.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, cssSize.width, cssSize.height)
    setHasInk(false)
    onChange('')
  }

  const onUploadClick = () => {
    fileInputRef.current?.click()
  }

  const onUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.readAsDataURL(file)
    })
    setMode('draw')
    setHasInk(true)
    onChange(dataUrl)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`h-10 rounded-xl border px-4 text-sm font-semibold ${
            mode === 'draw' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => setMode('type')}
          className={`h-10 rounded-xl border px-4 text-sm font-semibold ${
            mode === 'type' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          Type
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('upload')
            onUploadClick()
          }}
          className={`h-10 rounded-xl border px-4 text-sm font-semibold ${
            mode === 'upload'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          Upload image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={onUploadChange}
        />
      </div>

      {mode === 'type' ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">
            Signature name
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
              placeholder="Type your name"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Style
            <select
              value={typedStyle}
              onChange={e => setTypedStyle(e.target.value as typeof typedStyle)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
            >
              <option value="regular">Regular</option>
              <option value="italic">Italic</option>
              <option value="bold_italic">Bold italic</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => renderTypedSignature(typedName, typedStyle)}
            className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        width={cssSize.width}
        height={cssSize.height}
        className="w-full touch-none rounded-xl border border-slate-300 bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
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
