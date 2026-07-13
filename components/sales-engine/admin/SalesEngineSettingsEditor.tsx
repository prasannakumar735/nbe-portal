'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { SalesEngineSettingDefinition } from '@/lib/sales/types/salesEngineSettings.types'
import type { SalesEngineAdminSettingsResponse } from '@/lib/sales/settings/salesEngineAdminSettingsService'
import { SALES_ENGINE_DELIVERABILITY_AUTH_STATUSES } from '@/lib/sales/settings/salesEngineSettingDefinitions'

type SalesEngineSettingsEditorProps = {
  definitions: SalesEngineSettingDefinition[]
  values: Record<string, unknown>
  saving: boolean
  readOnly?: boolean
  onSave: (patches: { key: string; value: unknown }[]) => Promise<void>
}

export function SalesEngineSettingsEditor({
  definitions,
  values,
  saving,
  readOnly = false,
  onSave,
}: SalesEngineSettingsEditorProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...values }))

  useEffect(() => {
    setDraft({ ...values })
  }, [values])

  const dirtyKeys = useMemo(() => {
    const keys: string[] = []
    for (const def of definitions) {
      if (draft[def.key] !== values[def.key]) keys.push(def.key)
    }
    return keys
  }, [definitions, draft, values])

  const setDraftValue = useCallback((key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const save = useCallback(async () => {
    const patches = dirtyKeys.map((key) => ({ key, value: draft[key] }))
    if (patches.length === 0) return
    try {
      await onSave(patches)
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }, [dirtyKeys, draft, onSave])

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {definitions.map((def) => (
          <li key={def.key} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{def.label}</p>
                <p className="mt-0.5 text-xs text-slate-600">{def.description}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">{def.key}</p>
              </div>
              <div className="shrink-0">
                {def.valueType === 'boolean' ? (
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={readOnly || saving}
                      checked={Boolean(draft[def.key])}
                      onChange={(e) => setDraftValue(def.key, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {draft[def.key] ? 'Enabled' : 'Disabled'}
                  </label>
                ) : def.valueType === 'string' &&
                  (def.key.startsWith('deliverability.') && def.key.endsWith('_status')) ? (
                  <select
                    disabled={readOnly || saving}
                    value={String(draft[def.key] ?? 'unknown')}
                    onChange={(e) => setDraftValue(def.key, e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                  >
                    {SALES_ENGINE_DELIVERABILITY_AUTH_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : def.valueType === 'string' ? (
                  <input
                    type="text"
                    disabled={readOnly || saving}
                    value={String(draft[def.key] ?? '')}
                    onChange={(e) => setDraftValue(def.key, e.target.value)}
                    className="w-64 max-w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                ) : def.valueType === 'number' ? (
                  <input
                    type="number"
                    min={0}
                    disabled={readOnly || saving}
                    value={draft[def.key] == null ? '' : String(draft[def.key])}
                    onChange={(e) => {
                      const v = e.target.value.trim()
                      setDraftValue(def.key, v === '' ? null : Number(v))
                    }}
                    className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    placeholder="null"
                  />
                ) : (
                  <span className="text-xs text-slate-500">Reserved (future)</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!readOnly ? (
        <button
          type="button"
          disabled={saving || dirtyKeys.length === 0}
          onClick={() => void save()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      ) : (
        <p className="text-sm text-amber-800">Only administrators can change settings.</p>
      )}
    </div>
  )
}

export function filterDefinitions(
  data: SalesEngineAdminSettingsResponse | null,
  groups: SalesEngineSettingDefinition['group'][],
): SalesEngineSettingDefinition[] {
  if (!data) return []
  return data.definitions.filter((d) => groups.includes(d.group))
}
