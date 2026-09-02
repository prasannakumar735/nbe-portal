'use client'

import { useEffect, useState, useTransition } from 'react'

type SettingRow = {
  key: string
  label: string
  description: string
  value: number
  min: number
  max: number
  unit: string
  defaultValue: number
}

export function NotificationSettingsClient() {
  const [settings, setSettings] = useState<SettingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/notification-settings')
        const json = await res.json() as { ok?: boolean; data?: SettingRow[]; error?: string }
        if (!res.ok || !json.ok) { setError(json.error ?? 'Failed to load'); return }
        setSettings(json.data ?? [])
        const d: Record<string, string> = {}
        for (const s of json.data ?? []) d[s.key] = String(s.value)
        setDrafts(d)
      } catch {
        setError('Failed to load notification settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function handleDraftChange(key: string, raw: string) {
    setDrafts(prev => ({ ...prev, [key]: raw }))
    setSaveError(null)
    setSaveSuccess(null)
  }

  async function save(setting: SettingRow) {
    const raw = drafts[setting.key] ?? ''
    const parsed = parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < setting.min || parsed > setting.max) {
      setSaveError(`${setting.label}: must be between ${setting.min} and ${setting.max}`)
      return
    }
    setSavingKey(setting.key)
    setSaveError(null)
    setSaveSuccess(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/notification-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: setting.key, value: parsed }),
        })
        const json = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok || !json.ok) {
          setSaveError(json.error ?? 'Failed to save')
        } else {
          setSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: parsed } : s))
          setSaveSuccess(`${setting.label} updated to ${parsed} ${setting.unit}`)
        }
      } catch {
        setSaveError('Network error — please try again')
      } finally {
        setSavingKey(null)
      }
    })
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading settings…</p>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {saveSuccess}
        </div>
      )}

      {settings.map(s => {
        const draft = drafts[s.key] ?? String(s.value)
        const parsed = parseInt(draft, 10)
        const dirty = parsed !== s.value && Number.isFinite(parsed)
        const invalid = !Number.isFinite(parsed) || parsed < s.min || parsed > s.max

        return (
          <div
            key={s.key}
            className="rounded-xl border border-slate-200 bg-white px-5 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{s.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">{s.key}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={s.min}
                    max={s.max}
                    value={draft}
                    onChange={e => handleDraftChange(s.key, e.target.value)}
                    className={`h-9 w-24 rounded-lg border pr-10 pl-3 text-sm font-medium focus:outline-none focus:ring-2 ${
                      invalid
                        ? 'border-red-300 focus:ring-red-400'
                        : dirty
                          ? 'border-indigo-300 focus:ring-indigo-400'
                          : 'border-slate-300 focus:ring-indigo-400'
                    }`}
                  />
                  <span className="absolute right-3 text-xs text-slate-400">{s.unit}</span>
                </div>
                <button
                  type="button"
                  disabled={!dirty || invalid || savingKey === s.key}
                  onClick={() => void save(s)}
                  className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {savingKey === s.key ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Range: {s.min}–{s.max} {s.unit} · Default: {s.defaultValue} {s.unit}
            </p>
          </div>
        )
      })}

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        <strong>Note:</strong> Changes take effect on the next daily cron run (8:00 AM Melbourne time).
        The door service alert job reads these values fresh on every run.
      </div>
    </div>
  )
}
