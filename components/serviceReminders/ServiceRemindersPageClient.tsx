'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Ban } from 'lucide-react'
import type { ClientServiceDueReminderRow } from '@/lib/serviceReminders/types'

export function ServiceRemindersPageClient() {
  const [reminders, setReminders] = useState<ClientServiceDueReminderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'cancelled' | 'done' | 'all'>('active')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      const res = await fetch(`/api/service-due-reminders${q}`, { credentials: 'same-origin' })
      const json = (await res.json()) as {
        ok?: boolean
        data?: { reminders?: ClientServiceDueReminderRow[] }
        error?: string
      }
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Could not load reminders')
        setReminders([])
        return
      }
      setReminders(json.data?.reminders ?? [])
    } catch {
      setError('Could not load reminders')
      setReminders([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const cancelReminder = async (id: string) => {
    if (!window.confirm('Cancel this reminder?')) return
    const res = await fetch(`/api/service-due-reminders/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    const json = (await res.json()) as { ok?: boolean }
    if (res.ok && json.ok) void load()
    else alert('Could not cancel')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Client service reminders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Scheduled maintenance due dates and advance emails to managers (and optional client contacts).
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</label>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="active">Active</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : reminders.length === 0 ? (
        <p className="text-sm text-gray-500">No reminders found. Create one from the calendar (New → Client reminder).</p>
      ) : (
        <ul className="space-y-3">
          {reminders.map(r => (
            <li
              key={r.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{r.title}</p>
                  <p className="text-sm text-gray-600">{r.client_name ?? r.client_id.slice(0, 8)}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.status === 'active'
                      ? 'bg-teal-50 text-teal-800'
                      : r.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-50 text-blue-800'
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <dl className="mt-3 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-gray-400">Due</dt>
                  <dd>{r.due_date}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-gray-400">Remind</dt>
                  <dd>{r.lead_time_days} day(s) before</dd>
                </div>
                {r.last_service_date && (
                  <div>
                    <dt className="text-xs uppercase text-gray-400">Last service</dt>
                    <dd>{r.last_service_date}</dd>
                  </div>
                )}
                {r.reminder_sent_at && (
                  <div>
                    <dt className="text-xs uppercase text-gray-400">Email sent</dt>
                    <dd>{new Date(r.reminder_sent_at).toLocaleString()}</dd>
                  </div>
                )}
                {r.client_contact_email && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase text-gray-400">Client contact</dt>
                    <dd>{r.client_contact_email}</dd>
                  </div>
                )}
              </dl>
              {r.status === 'active' && (
                <button
                  type="button"
                  onClick={() => void cancelReminder(r.id)}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <Ban className="h-3.5 w-3.5" aria-hidden />
                  Cancel reminder
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
