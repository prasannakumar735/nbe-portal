'use client'

import { useEffect, useState, useRef, useTransition } from 'react'

type NumericSetting = {
  type: 'numeric'
  key: string
  label: string
  description: string
  value: number
  min: number
  max: number
  unit: string
  defaultValue: number
}

type ToggleSetting = {
  type: 'toggle'
  key: string
  label: string
  description: string
  value: boolean
  defaultValue: boolean
}

type EmailListSetting = {
  type: 'email_list'
  key: string
  label: string
  description: string
  value: string
  defaultValue: string
}

type AnySettingRow = NumericSetting | ToggleSetting | EmailListSetting

const NBE_DOMAIN = '@nbeaustralia.com.au'

export function NotificationSettingsClient() {
  const [settings, setSettings] = useState<AnySettingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/notification-settings')
        const json = await res.json() as { ok?: boolean; data?: AnySettingRow[]; error?: string }
        if (!res.ok || !json.ok) { setError(json.error ?? 'Failed to load'); return }
        setSettings(json.data ?? [])
      } catch {
        setError('Failed to load notification settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function patchSetting(key: string, value: unknown) {
    setSavingKey(key)
    setSaveError(null)
    setSaveSuccess(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/notification-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
        const json = await res.json() as { ok?: boolean; error?: string; data?: { value: unknown } }
        if (!res.ok || !json.ok) {
          setSaveError(json.error ?? 'Failed to save')
        } else {
          setSettings(prev => prev.map(s => s.key === key ? { ...s, value } as AnySettingRow : s))
          const def = settings.find(s => s.key === key)
          setSaveSuccess(`${def?.label ?? key} updated`)
        }
      } catch {
        setSaveError('Network error — please try again')
      } finally {
        setSavingKey(null)
      }
    })
  }

  if (loading) return <p className="text-sm text-slate-500">Loading settings…</p>
  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  )

  const toggles = settings.filter((s): s is ToggleSetting => s.type === 'toggle')
  const emailLists = settings.filter((s): s is EmailListSetting => s.type === 'email_list')
  const numerics = settings.filter((s): s is NumericSetting => s.type === 'numeric')

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}
      {saveSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{saveSuccess}</div>
      )}

      {/* ── Toggle settings ── */}
      {toggles.length > 0 && (
        <div className="space-y-3">
          {toggles.map(s => (
            <ToggleRow key={s.key} s={s} saving={savingKey === s.key} onToggle={v => void patchSetting(s.key, v)} />
          ))}
        </div>
      )}

      {/* ── Email list settings ── */}
      {emailLists.length > 0 && (
        <div className="space-y-3">
          {emailLists.map(s => (
            <EmailListRow key={s.key} s={s} saving={savingKey === s.key} onSave={v => void patchSetting(s.key, v)} />
          ))}
        </div>
      )}

      {/* ── Numeric settings ── */}
      {numerics.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Timing thresholds</p>
          {numerics.map(s => (
            <NumericRow key={s.key} s={s} saving={savingKey === s.key} onSave={v => void patchSetting(s.key, v)} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        <strong>Note:</strong> Changes take effect on the next daily cron run (8:00 AM Melbourne time).
        The door service alert job reads these values fresh on every run.
      </div>
    </div>
  )
}

// ── Toggle row ──────────────────────────────────────────────────────────────

function ToggleRow({ s, saving, onToggle }: { s: ToggleSetting; saving: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="min-w-0 flex-1 pr-6">
        <p className="text-sm font-medium text-slate-900">{s.label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
        <p className="mt-1 font-mono text-[10px] text-slate-400">{s.key}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`text-xs font-medium ${s.value ? 'text-green-600' : 'text-slate-400'}`}>
          {s.value ? 'Enabled' : 'Disabled'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={s.value}
          disabled={saving}
          onClick={() => onToggle(!s.value)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 ${
            s.value ? 'bg-indigo-600' : 'bg-slate-200'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${s.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  )
}

// ── Email list row ──────────────────────────────────────────────────────────

function EmailListRow({ s, saving, onSave }: { s: EmailListSetting; saving: boolean; onSave: (v: string) => void }) {
  const [chips, setChips] = useState<string[]>(() => s.value ? s.value.split(',').map(e => e.trim()).filter(Boolean) : [])
  const [draft, setDraft] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDirty = chips.join(',') !== s.value

  function addChip(raw: string) {
    const email = raw.trim().toLowerCase()
    if (!email) return
    if (!email.endsWith(NBE_DOMAIN)) {
      setInputError(`Must be an ${NBE_DOMAIN} address`)
      return
    }
    if (chips.includes(email)) { setDraft(''); return }
    setChips(prev => [...prev, email])
    setDraft('')
    setInputError(null)
  }

  function removeChip(email: string) {
    setChips(prev => prev.filter(e => e !== email))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addChip(draft)
    } else if (e.key === 'Backspace' && !draft && chips.length > 0) {
      setChips(prev => prev.slice(0, -1))
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-slate-900">{s.label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
        <p className="mt-1 font-mono text-[10px] text-slate-400">{s.key}</p>
      </div>

      <div
        className="flex min-h-[42px] flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map(email => (
          <span key={email} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-indigo-700">
            {email}
            <button type="button" onClick={() => removeChip(email)} className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-700">
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={e => { setDraft(e.target.value); setInputError(null) }}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (draft.trim()) addChip(draft) }}
          placeholder={chips.length === 0 ? `name${NBE_DOMAIN}, press Enter` : ''}
          className="min-w-[180px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {inputError && <p className="mt-1 text-xs text-red-600">{inputError}</p>}
      {chips.length === 0 && (
        <p className="mt-1 text-xs text-slate-400">Empty = notify all portal managers &amp; admins automatically</p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!isDirty || saving}
          onClick={() => onSave(chips.join(','))}
          className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Numeric row ─────────────────────────────────────────────────────────────

function NumericRow({ s, saving, onSave }: { s: NumericSetting; saving: boolean; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(s.value))
  const parsed = parseInt(draft, 10)
  const dirty = parsed !== s.value && Number.isFinite(parsed)
  const invalid = !Number.isFinite(parsed) || parsed < s.min || parsed > s.max

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
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
              onChange={e => setDraft(e.target.value)}
              className={`h-9 w-24 rounded-lg border pr-10 pl-3 text-sm font-medium focus:outline-none focus:ring-2 ${
                invalid ? 'border-red-300 focus:ring-red-400' : dirty ? 'border-indigo-300 focus:ring-indigo-400' : 'border-slate-300 focus:ring-indigo-400'
              }`}
            />
            <span className="absolute right-3 text-xs text-slate-400">{s.unit}</span>
          </div>
          <button
            type="button"
            disabled={!dirty || invalid || saving}
            onClick={() => onSave(parsed)}
            className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Range: {s.min}–{s.max} {s.unit} · Default: {s.defaultValue} {s.unit}
      </p>
    </div>
  )
}
