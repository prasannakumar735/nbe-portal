'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
  content: ReactNode
  children: ReactNode
  /** When true, no tooltip is shown */
  disabled?: boolean
  /** Passed to wrapper so grid cells shrink correctly */
  className?: string
}

const EDGE = 10
const OFFSET = 8

/**
 * Lightweight hover tooltip. Renders panel in `document.body` so it escapes
 * `overflow:hidden` stacking contexts (calendar grid columns).
 */
export function Tooltip({ content, children, disabled, className }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, placeAbove: false })

  const updatePosition = useCallback(() => {
    const anchor = wrapRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const panelEl = panelRef.current
    const estH =
      panelEl?.offsetHeight ??
      Math.min(260, typeof window !== 'undefined' ? window.innerHeight * 0.35 : 200)

    const centerX = rect.left + rect.width / 2
    const left = Math.max(EDGE, Math.min(centerX, window.innerWidth - EDGE))

    const spaceBelow = window.innerHeight - rect.bottom - OFFSET
    const placeAbove =
      rect.bottom + OFFSET + estH > window.innerHeight - EDGE && rect.top > spaceBelow + estH * 0.5

    const top = placeAbove ? rect.top - OFFSET : rect.bottom + OFFSET

    setPos({ top, left, placeAbove })
  }, [])

  useLayoutEffect(() => {
    if (!open || disabled) return
    updatePosition()
  }, [open, disabled, content, updatePosition])

  useEffect(() => {
    if (!open || disabled) return
    const onScrollResize = () => updatePosition()
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    const id = window.requestAnimationFrame(updatePosition)
    return () => {
      window.cancelAnimationFrame(id)
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
  }, [open, disabled, updatePosition])

  const hoverHandlers = disabled
    ? {}
    : {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
      }

  const panel =
    open &&
    !disabled &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={panelRef}
        role="tooltip"
        className="pointer-events-none fixed z-[9999] w-[min(18rem,calc(100vw-20px))] rounded-lg border border-gray-200 bg-white px-3 py-2 text-left shadow-lg ring-1 ring-black/5"
        style={{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          transform: pos.placeAbove ? `translate(-50%, -100%)` : `translate(-50%, 0)`,
        }}
      >
        <div className="text-xs leading-relaxed text-gray-700">{content}</div>
      </div>,
      document.body,
    )

  return (
    <>
      <span
        ref={wrapRef}
        className={`block min-h-0 min-w-0 h-full max-w-full w-full ${className ?? ''}`}
        {...hoverHandlers}
      >
        {children}
      </span>
      {panel}
    </>
  )
}
