'use client'

import { useState } from 'react'
import type {
  CreateClientWithLocationPayload,
  CreateClientWithLocationResult,
} from '@/lib/clients/createMaintenanceClient'

const fieldClass =
  'mt-1.5 block w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'block min-w-0 text-xs font-semibold text-slate-600'

type Props = {
  disabled?: boolean
  /** When true, location fields are required (maintenance reports). */
  requireLocation?: boolean
  defaultClientName?: string
  onCreate: (payload: CreateClientWithLocationPayload) => Promise<CreateClientWithLocationResult>
  onCreated: (result: CreateClientWithLocationResult) => void | Promise<void>
  toggleLabel?: string
}

export function InlineCreateClientPanel({
  disabled = false,
  requireLocation = false,
  defaultClientName = '',
  onCreate,
  onCreated,
  toggleLabel = 'Add new client…',
}: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [clientName, setClientName] = useState(defaultClientName)
  const [addLocation, setAddLocation] = useState(true)
  const [locationName, setLocationName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [suburb, setSuburb] = useState('')

  const resetFields = () => {
    setClientName('')
    setLocationName('')
    setCompanyAddress('')
    setSuburb('')
    setAddLocation(true)
    setErr(null)
  }

  const submit = async () => {
    const trimmedName = clientName.trim()
    if (!trimmedName) {
      setErr('Client name is required.')
      return
    }
    const wantsLocation = requireLocation || addLocation
    if (wantsLocation) {
      if (!locationName.trim()) {
        setErr('Location name is required.')
        return
      }
      if (!companyAddress.trim()) {
        setErr('Address is required.')
        return
      }
    }

    setBusy(true)
    setErr(null)
    try {
      const payload: CreateClientWithLocationPayload = { clientName: trimmedName }
      if (wantsLocation) {
        payload.location = {
          locationName: locationName.trim(),
          companyAddress: companyAddress.trim(),
          ...(suburb.trim() ? { suburb: suburb.trim() } : {}),
        }
      }
      const created = await onCreate(payload)
      await onCreated(created)
      setOpen(false)
      resetFields()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create client.')
    } finally {
      setBusy(false)
    }
  }

  if (disabled) return null

  return (
    <div className="mt-1">
      <button
        type="button"
        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
        onClick={() => {
          setOpen(v => !v)
          setErr(null)
          if (!open && defaultClientName.trim() && !clientName.trim()) {
            setClientName(defaultClientName.trim())
          }
        }}
      >
        {open ? 'Cancel new client' : toggleLabel}
      </button>

      {open ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          {err ? (
            <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
              {err}
            </p>
          ) : null}

          <label className={labelClass}>
            Client name
            <input
              disabled={busy}
              className={fieldClass}
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="e.g. Confoil"
              autoComplete="organization"
            />
          </label>

          {!requireLocation ? (
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={addLocation}
                disabled={busy}
                onChange={e => setAddLocation(e.target.checked)}
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Add first location now (recommended)
            </label>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Site location and address are required for this report.</p>
          )}

          {requireLocation || addLocation ? (
            <div className="mt-3 space-y-3">
              <label className={labelClass}>
                Location name
                <input
                  disabled={busy}
                  className={fieldClass}
                  value={locationName}
                  onChange={e => setLocationName(e.target.value)}
                  placeholder="e.g. Factory / Head Office"
                />
              </label>
              <label className={labelClass}>
                Address
                <input
                  disabled={busy}
                  className={fieldClass}
                  value={companyAddress}
                  onChange={e => setCompanyAddress(e.target.value)}
                  placeholder="Street address"
                />
              </label>
              <label className={labelClass}>
                Suburb (optional)
                <input
                  disabled={busy}
                  className={fieldClass}
                  value={suburb}
                  onChange={e => setSuburb(e.target.value)}
                  placeholder="Suburb"
                />
              </label>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => {
                setOpen(false)
                setErr(null)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
              onClick={() => void submit()}
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
