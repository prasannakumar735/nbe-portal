'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Ban, ChevronDown, ChevronRight, Bell, BellOff, AlertTriangle, Clock, CalendarDays, CheckCircle2 } from 'lucide-react'
import type { ClientServiceDueReminderRow } from '@/lib/serviceReminders/types'

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'manual'
type StatusFilter = 'active' | 'cancelled' | 'done' | 'all'

type DoorEntry = {
  id: string
  door_label: string
  door_type: string | null
  due_date: string
  notify_date: string
  last_inspection_date: string | null
  install_date: string | null
  already_alerted: boolean
  status: 'overdue' | 'next7' | 'next14' | 'next30' | 'future'
  client_location_id: string
}

type LocationSummary = {
  locationId: string
  locationName: string
  doors: DoorEntry[]
  earliestDue: string
  alertEmailSentAt: string | null
}

type ClientGroup = {
  clientId: string
  clientName: string
  locations: LocationSummary[]
  doorCount: number
  overdueCount: number
  nextAlertCount: number
}

type DashboardData = {
  stats: {
    overdue: number
    next7: number
    next14: number
    next30: number
    total: number
    pendingAlerts: number
    clientsAffected: number
  }
  groups: ClientGroup[]
  leadTimeDays: number
  serviceIntervalMonths: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusBadge(status: DoorEntry['status']) {
  switch (status) {
    case 'overdue':
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"><AlertTriangle className="h-3 w-3" />Overdue</span>
    case 'next7':
      return <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700"><Clock className="h-3 w-3" />Due in 7 days</span>
    case 'next14':
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"><Clock className="h-3 w-3" />Due in 14 days</span>
    case 'next30':
      return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700"><CalendarDays className="h-3 w-3" />Due in 30 days</span>
    default:
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Upcoming</span>
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, colour }: { value: number; label: string; colour: string }) {
  return (
    <div className={`rounded-xl border p-4 ${colour}`}>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-75">{label}</p>
    </div>
  )
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/door-service-alerts', { credentials: 'same-origin' })
        const json = await res.json() as { ok?: boolean; data?: DashboardData; error?: string }
        if (!res.ok || !json.ok) { setError(json.error ?? 'Failed to load'); return }
        setData(json.data ?? null)
        // Auto-expand only the first client that has overdue or imminent doors
        const auto = new Set<string>()
        const firstAlert = (json.data?.groups ?? []).find(g => g.overdueCount > 0 || g.nextAlertCount > 0)
        if (firstAlert) auto.add(firstAlert.clientId)
        setExpanded(auto)
      } catch {
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function toggleClient(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll(groups: ClientGroup[]) {
    setExpanded(new Set(groups.map(g => g.clientId)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />Loading…
    </div>
  )
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
  if (!data) return null

  const { stats, groups, leadTimeDays, serviceIntervalMonths } = data

  return (
    <div className="space-y-6">
      {/* Config banner */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>Service interval: <strong>{serviceIntervalMonths} months</strong></span>
        <span>Alert lead time: <strong>{leadTimeDays} days before due</strong></span>
        <a href="/admin/settings?tab=notifications" className="ml-auto text-indigo-600 hover:underline">Adjust settings →</a>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={stats.overdue} label="Overdue" colour="border-red-200 bg-red-50 text-red-800" />
        <StatCard value={stats.next7} label="Due in 7 days" colour="border-orange-200 bg-orange-50 text-orange-800" />
        <StatCard value={stats.next14} label="Due in 14 days" colour="border-amber-200 bg-amber-50 text-amber-800" />
        <StatCard value={stats.next30} label="Due in 30 days" colour="border-yellow-100 bg-yellow-50 text-yellow-800" />
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span>{stats.clientsAffected} client{stats.clientsAffected !== 1 ? 's' : ''} affected</span>
          <span>{stats.total} door{stats.total !== 1 ? 's' : ''} in alert window</span>
          {stats.pendingAlerts > 0 && (
            <span className="font-semibold text-indigo-700">
              {stats.pendingAlerts} door{stats.pendingAlerts !== 1 ? 's' : ''} pending email alert (next cron run)
            </span>
          )}
        </div>
        {groups.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => expandAll(groups)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      {/* Client groups */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-teal-400" />
          No doors are approaching their service due date in the next 30 days.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const open = expanded.has(group.clientId)
            return (
              <div key={group.clientId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {/* Client header */}
                <button
                  type="button"
                  onClick={() => toggleClient(group.clientId)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <div>
                      <p className="font-semibold text-slate-900">{group.clientName}</p>
                      <p className="text-xs text-slate-500">
                        {group.locations.length} location{group.locations.length !== 1 ? 's' : ''} · {group.doorCount} door{group.doorCount !== 1 ? 's' : ''} in window
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.overdueCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                        {group.overdueCount} overdue
                      </span>
                    )}
                    {group.nextAlertCount > 0 && (
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                        {group.nextAlertCount} to alert
                      </span>
                    )}
                  </div>
                </button>

                {/* Location list */}
                {open && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {group.locations.map(loc => (
                      <div key={loc.locationId} className="px-5 py-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{loc.locationName}</p>
                          {loc.alertEmailSentAt ? (
                            <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                              <Bell className="h-3 w-3" />
                              Alert sent {fmtDate(loc.alertEmailSentAt.slice(0, 10))}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <BellOff className="h-3 w-3" />
                              No alert sent yet
                            </span>
                          )}
                        </div>

                        {/* Door table */}
                        <div className="overflow-x-auto rounded-lg border border-slate-100">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500">
                                <th className="px-3 py-2 font-medium">Door</th>
                                <th className="px-3 py-2 font-medium">Type</th>
                                <th className="px-3 py-2 font-medium">Last serviced</th>
                                <th className="px-3 py-2 font-medium">Due date</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 font-medium">Alert</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loc.doors.map(door => (
                                <tr key={door.id} className="border-t border-slate-100 hover:bg-slate-50">
                                  <td className="px-3 py-2 font-medium text-slate-900">{door.door_label || '—'}</td>
                                  <td className="px-3 py-2 text-slate-600">{door.door_type ?? '—'}</td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {door.last_inspection_date
                                      ? fmtDate(door.last_inspection_date)
                                      : door.install_date
                                        ? <span className="text-slate-400">Not serviced (installed {fmtDate(door.install_date)})</span>
                                        : <span className="text-slate-400">No date</span>
                                    }
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-slate-900">{fmtDate(door.due_date)}</td>
                                  <td className="px-3 py-2">{statusBadge(door.status)}</td>
                                  <td className="px-3 py-2">
                                    {door.already_alerted
                                      ? <span className="text-teal-600 text-xs">✓ Alerted</span>
                                      : <span className="text-indigo-600 text-xs font-medium">Pending (by {fmtDate(door.notify_date)})</span>
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Manual reminders tab ──────────────────────────────────────────────────────

function ManualRemindersTab() {
  const [reminders, setReminders] = useState<ClientServiceDueReminderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      const res = await fetch(`/api/service-due-reminders${q}`, { credentials: 'same-origin' })
      const json = await res.json() as { ok?: boolean; data?: { reminders?: ClientServiceDueReminderRow[] }; error?: string }
      if (!res.ok || !json.ok) { setError(json.error ?? 'Could not load reminders'); setReminders([]); return }
      setReminders(json.data?.reminders ?? [])
    } catch {
      setError('Could not load reminders')
      setReminders([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  const cancelReminder = async (id: string) => {
    if (!window.confirm('Cancel this reminder?')) return
    const res = await fetch(`/api/service-due-reminders/${id}`, { method: 'DELETE', credentials: 'same-origin' })
    const json = await res.json() as { ok?: boolean }
    if (res.ok && json.ok) void load()
    else alert('Could not cancel')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="active">Active</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
        <p className="ml-auto text-xs text-slate-400">Create reminders from the calendar (New → Client reminder)</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />Loading…
        </div>
      ) : reminders.length === 0 ? (
        <p className="text-sm text-slate-500">No reminders found.</p>
      ) : (
        <ul className="space-y-3">
          {reminders.map(r => (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{r.title}</p>
                  <p className="text-sm text-slate-600">{r.client_name ?? r.client_id.slice(0, 8)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.status === 'active' ? 'bg-teal-50 text-teal-800' : r.status === 'cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-800'
                }`}>{r.status}</span>
              </div>
              <dl className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                <div><dt className="text-xs uppercase text-slate-400">Due</dt><dd>{fmtDate(r.due_date)}</dd></div>
                <div><dt className="text-xs uppercase text-slate-400">Remind</dt><dd>{r.lead_time_days} day(s) before</dd></div>
                {r.last_service_date && <div><dt className="text-xs uppercase text-slate-400">Last service</dt><dd>{fmtDate(r.last_service_date)}</dd></div>}
                {r.reminder_sent_at && <div><dt className="text-xs uppercase text-slate-400">Email sent</dt><dd>{new Date(r.reminder_sent_at).toLocaleString()}</dd></div>}
                {r.client_contact_email && <div className="sm:col-span-2"><dt className="text-xs uppercase text-slate-400">Client contact</dt><dd>{r.client_contact_email}</dd></div>}
              </dl>
              {r.status === 'active' && (
                <button
                  type="button"
                  onClick={() => void cancelReminder(r.id)}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Ban className="h-3.5 w-3.5" />Cancel reminder
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page shell ────────────────────────────────────────────────────────────────

export function ServiceRemindersPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'dashboard', label: 'Door Service Dashboard' },
    { key: 'manual', label: 'Manual Reminders' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Service Reminders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Automated door service tracking and manually scheduled client maintenance reminders.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' ? <DashboardTab /> : <ManualRemindersTab />}
    </div>
  )
}
