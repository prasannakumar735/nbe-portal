'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { addMonthsToIsoDate, SERVICE_REMINDER_LEAD_TIME_DAYS } from '@/lib/serviceReminders/dueDate'
import type { ClientContactEmailRow } from '@/lib/serviceReminders/types'

const INPUT =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'
const LABEL = 'text-xs font-medium uppercase tracking-wide text-gray-500'

type ClientOption = { id: string; name: string }

type FormState = {
  title: string
  client_id: string
  last_service_date: string
  service_interval_months: number
  due_date: string
  lead_time_days: number
  send_manager_email: boolean
  send_client_email: boolean
  contact_mode: 'select' | 'other'
  client_contact_email_id: string
  client_contact_email: string
  client_contact_name: string
  save_contact: boolean
  notes: string
}

const defaultForm = (): FormState => ({
  title: '',
  client_id: '',
  last_service_date: '',
  service_interval_months: 6,
  due_date: new Date().toISOString().slice(0, 10),
  lead_time_days: 14,
  send_manager_email: true,
  send_client_email: false,
  contact_mode: 'select',
  client_contact_email_id: '',
  client_contact_email: '',
  client_contact_name: '',
  save_contact: false,
  notes: '',
})

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function ClientReminderModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(() => defaultForm())
  const [clients, setClients] = useState<ClientOption[]>([])
  const [contacts, setContacts] = useState<ClientContactEmailRow[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(defaultForm())
    setNewClientName('')
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoadingClients(true)
    void supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setClients((data as ClientOption[]).filter(c => c.id && c.name))
        } else setClients([])
        setLoadingClients(false)
      })
  }, [open])

  const loadContacts = useCallback(async (clientId: string) => {
    if (!clientId) {
      setContacts([])
      return
    }
    setLoadingContacts(true)
    try {
      const res = await fetch(`/api/client-contact-emails?client_id=${encodeURIComponent(clientId)}`, {
        credentials: 'same-origin',
      })
      const json = (await res.json()) as { ok?: boolean; data?: { contacts?: ClientContactEmailRow[] } }
      setContacts(res.ok && json.ok ? (json.data?.contacts ?? []) : [])
    } catch {
      setContacts([])
    } finally {
      setLoadingContacts(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !form.client_id) {
      setContacts([])
      return
    }
    void loadContacts(form.client_id)
  }, [open, form.client_id, loadContacts])

  useEffect(() => {
    if (!form.last_service_date || !form.service_interval_months) return
    const next = addMonthsToIsoDate(form.last_service_date, form.service_interval_months)
    if (next) setForm(f => ({ ...f, due_date: next }))
  }, [form.last_service_date, form.service_interval_months])

  const contactOptions = useMemo(
    () => contacts.map(c => ({ value: c.id, label: c.name ? `${c.name} <${c.email}>` : c.email })),
    [contacts],
  )

  const resolvedContactEmail = useMemo(() => {
    if (form.contact_mode === 'other') return form.client_contact_email.trim()
    const sel = contacts.find(c => c.id === form.client_contact_email_id)
    return sel?.email?.trim() ?? ''
  }, [form.contact_mode, form.client_contact_email, form.client_contact_email_id, contacts])

  const handleAddClient = async () => {
    const name = newClientName.trim()
    if (!name) return
    setAddingClient(true)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ client_name: name }),
      })
      const json = (await res.json()) as { ok?: boolean; data?: { id: string; client_name?: string; name?: string }; error?: string }
      if (!res.ok || !json.ok || !json.data?.id) {
        alert(json.error ?? 'Could not create client')
        return
      }
      const id = json.data.id
      const label = String(json.data.client_name ?? json.data.name ?? name)
      setClients(prev => [...prev, { id, name: label }].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, client_id: id }))
      setNewClientName('')
    } catch {
      alert('Could not create client')
    } finally {
      setAddingClient(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.client_id || !form.due_date) return
    if (form.send_client_email && !resolvedContactEmail) {
      alert('Select or enter a client contact email.')
      return
    }

    setSaving(true)
    try {
      if (form.save_contact && form.contact_mode === 'other' && resolvedContactEmail && form.client_id) {
        await fetch('/api/client-contact-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            client_id: form.client_id,
            email: resolvedContactEmail,
            name: form.client_contact_name.trim() || null,
          }),
        })
      }

      const res = await fetch('/api/service-due-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          client_id: form.client_id,
          title: form.title.trim(),
          notes: form.notes.trim() || null,
          last_service_date: form.last_service_date.trim() || null,
          service_interval_months: form.last_service_date ? form.service_interval_months : null,
          due_date: form.due_date,
          lead_time_days: form.lead_time_days,
          send_manager_email: form.send_manager_email,
          send_client_email: form.send_client_email,
          client_contact_email: form.send_client_email ? resolvedContactEmail : null,
          client_contact_name: form.client_contact_name.trim() || null,
          client_contact_email_id:
            form.contact_mode === 'select' && form.client_contact_email_id
              ? form.client_contact_email_id
              : null,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        alert(json.error ?? 'Could not save reminder')
        return
      }
      onCreated?.()
      onClose()
    } catch {
      alert('Could not save reminder')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const submitDisabled =
    saving || !form.title.trim() || !form.client_id || !form.due_date || (form.send_client_email && !resolvedContactEmail)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <button type="button" className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 mx-auto flex min-h-full max-w-lg flex-col justify-center px-3 py-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-gray-200 px-4 py-4 md:px-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Client service due reminder</h2>
              <p className="mt-0.5 text-sm text-gray-500">Managers are notified before the due date to prepare client outreach.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="space-y-4 px-4 py-5 md:px-6">
            <label className="block">
              <span className={LABEL}>Event title</span>
              <input
                type="text"
                maxLength={200}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={INPUT}
                placeholder="e.g. 6-month scheduled service"
              />
            </label>

            <SearchableSelect
              id="client-reminder-client"
              label="Client"
              labelClassName={`block ${LABEL}`}
              value={form.client_id}
              disabled={loadingClients}
              onChange={id => setForm(f => ({ ...f, client_id: id, client_contact_email_id: '' }))}
              options={clients.map(c => ({ value: c.id, label: c.name }))}
              allowEmpty
              emptyLabel={loadingClients ? 'Loading…' : 'Select a client'}
              placeholder="Search clients…"
              className="[&_button]:mt-1 [&_button]:rounded-lg [&_button]:border-gray-300 [&_button]:bg-white [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm"
            />

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                placeholder="New client name"
                className={`${INPUT} mt-0 min-w-0 flex-1`}
              />
              <button
                type="button"
                disabled={addingClient || !newClientName.trim()}
                onClick={() => void handleAddClient()}
                className="mt-0 shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {addingClient ? 'Adding…' : 'Add client'}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Last service date</span>
                <input
                  type="date"
                  value={form.last_service_date}
                  onChange={e => setForm(f => ({ ...f, last_service_date: e.target.value }))}
                  className={INPUT}
                />
              </label>
              <label className="block">
                <span className={LABEL}>Interval (months)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.service_interval_months}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      service_interval_months: Math.max(1, parseInt(e.target.value, 10) || 6),
                    }))
                  }
                  className={INPUT}
                />
              </label>
            </div>

            <label className="block">
              <span className={LABEL}>Service due date</span>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className={INPUT}
              />
            </label>

            <label className="block">
              <span className={LABEL}>Remind me (before due date)</span>
              <select
                value={form.lead_time_days}
                onChange={e => setForm(f => ({ ...f, lead_time_days: Number(e.target.value) }))}
                className={INPUT}
              >
                {SERVICE_REMINDER_LEAD_TIME_DAYS.map(d => (
                  <option key={d} value={d}>
                    {d === 14 ? '2 weeks' : `${d} days`}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.send_manager_email}
                onChange={e => setForm(f => ({ ...f, send_manager_email: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-900">Email managers / service team (prep reminder)</span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.send_client_email}
                onChange={e => setForm(f => ({ ...f, send_client_email: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-900">Also email client contact (service due)</span>
            </label>

            {form.send_client_email && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <span className={LABEL}>Client contact email</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, contact_mode: 'select' }))}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      form.contact_mode === 'select' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Saved
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, contact_mode: 'other' }))}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      form.contact_mode === 'other' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Other
                  </button>
                </div>
                {form.contact_mode === 'select' ? (
                  <select
                    disabled={!form.client_id || loadingContacts}
                    value={form.client_contact_email_id}
                    onChange={e => setForm(f => ({ ...f, client_contact_email_id: e.target.value }))}
                    className={INPUT}
                  >
                    <option value="">
                      {!form.client_id
                        ? 'Select a client first'
                        : loadingContacts
                          ? 'Loading…'
                          : contacts.length === 0
                            ? 'No saved emails — use Other'
                            : 'Select contact email'}
                    </option>
                    {contactOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      type="email"
                      value={form.client_contact_email}
                      onChange={e => setForm(f => ({ ...f, client_contact_email: e.target.value }))}
                      className={INPUT}
                      placeholder="contact@client.com"
                    />
                    <input
                      type="text"
                      value={form.client_contact_name}
                      onChange={e => setForm(f => ({ ...f, client_contact_name: e.target.value }))}
                      className={INPUT}
                      placeholder="Contact name (optional)"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.save_contact}
                        onChange={e => setForm(f => ({ ...f, save_contact: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Save this email for this client
                    </label>
                  </>
                )}
              </div>
            )}

            <label className="block">
              <span className={LABEL}>Notes</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={INPUT}
                placeholder="Internal notes for managers…"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50/80 px-4 py-4 md:px-6">
            <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button
              type="button"
              disabled={submitDisabled}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:bg-gray-300"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {saving ? 'Saving…' : 'Create reminder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
