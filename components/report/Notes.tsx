'use client'

import { useMemo } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

function linesToBullets(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  const byNl = t.split(/\n+/).map(s => s.trim()).filter(Boolean)
  if (byNl.length > 1) return byNl
  return t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

type DoorNotesProps = {
  label?: string
  registration: UseFormRegisterReturn
  placeholder?: string
}

/** Door fault notes: textarea + live bullet preview for readability. */
export function DoorNotesField({
  label = 'Door notes',
  registration,
  placeholder = 'One issue per line, or separate sentences with periods.',
}: DoorNotesProps) {
  const value = registration.value ?? ''
  const bullets = useMemo(() => linesToBullets(String(value)), [value])

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        <textarea
          {...registration}
          rows={4}
          placeholder={placeholder}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
        />
      </label>
      {bullets.length > 0 ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Attention required</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {bullets.slice(0, 12).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
