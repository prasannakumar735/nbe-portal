'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type SearchableSelectOption = { value: string; label: string }

type Props = {
  id: string
  label: string
  value: string
  options: SearchableSelectOption[]
  placeholder?: string
  disabled?: boolean
  onChange: (next: string) => void
  /** When true, includes an empty option at top (value=""). */
  allowEmpty?: boolean
  emptyLabel?: string
  className?: string
  /** Override default label typography (e.g. match surrounding form labels). */
  labelClassName?: string
}

export function SearchableSelect({
  id,
  label,
  value,
  options,
  placeholder = 'Search…',
  disabled = false,
  onChange,
  allowEmpty = false,
  emptyLabel = 'Select…',
  className = '',
  labelClassName,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  })

  const selectedLabel = useMemo(() => {
    if (!value) return ''
    return options.find(o => o.value === value)?.label ?? ''
  }, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  const repositionPanel = () => {
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setPanelRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) })
  }

  useLayoutEffect(() => {
    if (!open) return
    repositionPanel()
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const onWin = () => repositionPanel()
    window.addEventListener('resize', onWin)
    return () => window.removeEventListener('resize', onWin)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const root = rootRef.current
      const panel = panelRef.current
      const t = e.target instanceof Node ? e.target : null
      if (!t) return
      if (root?.contains(t)) return
      if (panel?.contains(t)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  const portalMounted = typeof document !== 'undefined'

  const panel =
    open && portalMounted
      ? createPortal(
          <div
            ref={panelRef}
            id={`${id}-panel`}
            role="presentation"
            className="fixed z-[100] rounded-lg border border-slate-200 bg-white shadow-lg"
            style={{
              top: panelRect.top,
              left: panelRect.left,
              width: panelRect.width,
            }}
          >
            <div className="p-2">
              <input
                ref={inputRef}
                id={`${id}-search`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                onMouseDown={e => e.stopPropagation()}
              />
            </div>

            <div role="listbox" aria-label={label} className="max-h-64 overflow-auto py-1">
              {allowEmpty ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    !value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`}
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {emptyLabel}
                </button>
              ) : null}

              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
              ) : (
                filtered.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      o.value === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                    }`}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <span className="truncate">{o.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={`space-y-1 ${className}`}>
      <label
        htmlFor={id}
        className={labelClassName ?? 'block text-xs font-medium text-slate-700'}
      >
        {label}
      </label>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 ${
          open ? 'border-indigo-400 ring-2 ring-indigo-500/20' : ''
        }`}
        onClick={() => {
          if (disabled) return
          const next = !open
          setOpen(next)
          if (next) {
            setQuery('')
            queueMicrotask(() => repositionPanel())
          }
        }}
      >
        <span className={`min-w-0 truncate ${value ? '' : 'text-slate-500'}`}>
          {value ? selectedLabel || '—' : emptyLabel}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {panel}
    </div>
  )
}
