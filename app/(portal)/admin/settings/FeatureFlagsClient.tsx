'use client'

import { useState, useTransition } from 'react'

type FlagRow = {
  key: string
  label: string
  description: string
  enabled: boolean
}

export function FeatureFlagsClient({ initialFlags }: { initialFlags: FlagRow[] }) {
  const [flags, setFlags] = useState<FlagRow[]>(initialFlags)
  const [isPending, startTransition] = useTransition()
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(key: string, newEnabled: boolean) {
    setTogglingKey(key)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/feature-flags', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, enabled: newEnabled }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setError((json as { error?: string }).error ?? 'Failed to update flag')
        } else {
          setFlags((prev) =>
            prev.map((f) => (f.key === key ? { ...f, enabled: newEnabled } : f)),
          )
        }
      } catch {
        setError('Network error — please try again')
      } finally {
        setTogglingKey(null)
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {flags.map((flag) => {
        const isToggling = togglingKey === flag.key && isPending
        return (
          <div
            key={flag.key}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4"
          >
            <div className="min-w-0 flex-1 pr-6">
              <p className="text-sm font-medium text-slate-900">{flag.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{flag.description}</p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">{flag.key}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={flag.enabled}
              disabled={isToggling}
              onClick={() => toggle(flag.key, !flag.enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 ${
                flag.enabled ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  flag.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}
