'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type SiteInfo = {
  slug: string
  displayName: string
  configured: boolean
  defaultBreakMinutes: number
}

type OpenSession = {
  sessionId: string
  clockInAt: string
  siteSlug: string
  siteDisplayName: string
}

type Props = {
  initialSiteSlug: string
}

type FabTaskOpt = { id: string; name: string }

export function OfficeClockClient({ initialSiteSlug }: Props) {
  const siteSlug = useMemo(() => initialSiteSlug.trim().toLowerCase() || 'hq', [initialSiteSlug])
  const [sites, setSites] = useState<SiteInfo[]>([])
  const [openSession, setOpenSession] = useState<OpenSession | null>(null)
  const [isTechnician, setIsTechnician] = useState(false)
  const [fabTasks, setFabTasks] = useState<FabTaskOpt[]>([])
  const [fabTaskId, setFabTaskId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sRes, stRes] = await Promise.all([
        fetch('/api/office-clock/sites', { cache: 'no-store' }),
        fetch('/api/office-clock/status', { cache: 'no-store' }),
      ])
      if (sRes.ok) {
        const j = (await sRes.json()) as { sites?: SiteInfo[] }
        setSites(j.sites ?? [])
      } else {
        setSites([])
      }
      if (stRes.ok) {
        const j = (await stRes.json()) as { openSession?: OpenSession | null; isTechnician?: boolean }
        let openSessionResolved = j.openSession ?? null
        let technicianResolved = Boolean(j.isTechnician)

        if (openSessionResolved) {
          try {
            const pr = await fetch('/api/office-clock/resolve-self-forgotten', { method: 'POST' })
            if (pr.ok) {
              const pj = (await pr.json()) as { resolved?: boolean; message?: string; closedDate?: string }
              if (pj.resolved) {
                const stAgain = await fetch('/api/office-clock/status', { cache: 'no-store' })
                if (stAgain.ok) {
                  const j2 = (await stAgain.json()) as {
                    openSession?: OpenSession | null
                    isTechnician?: boolean
                  }
                  openSessionResolved = j2.openSession ?? null
                  technicianResolved = Boolean(j2.isTechnician)
                  if (typeof pj.message === 'string' && pj.message.trim()) {
                    setMessage(pj.message.trim())
                  }
                }
              }
            }
          } catch {
            /* stale-resolve is best-effort; ignore network errors here */
          }
        }

        setOpenSession(openSessionResolved)
        setIsTechnician(technicianResolved)
      } else {
        setOpenSession(null)
        setIsTechnician(false)
      }
    } catch {
      setError('Could not load office clock.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    async function loadFab() {
      if (!openSession || !isTechnician) {
        if (!cancelled) {
          setFabTasks([])
          setFabTaskId('')
        }
        return
      }
      const res = await fetch('/api/office-clock/fab-tasks', { cache: 'no-store' })
      if (!res.ok || cancelled) return
      const j = (await res.json()) as { tasks?: FabTaskOpt[] }
      if (cancelled) return
      setFabTasks(j.tasks ?? [])
    }
    void loadFab()
    return () => {
      cancelled = true
    }
  }, [openSession, isTechnician])

  const selectedSite = useMemo(() => sites.find(s => s.slug === siteSlug), [sites, siteSlug])
  const configured = selectedSite?.configured ?? false

  const signIn = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/office-clock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteSlug }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Sign in failed.')
        return
      }
      setMessage('Signed in. Your timesheet will be updated when you sign out this evening.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const outBody: { workTypeLevel2Id?: string } = {}
      if (isTechnician && fabTaskId.trim()) outBody.workTypeLevel2Id = fabTaskId.trim()
      const res = await fetch('/api/office-clock/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outBody),
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        ok?: boolean
        totalHours?: number
        entryDate?: string
      }
      if (!res.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Sign out failed.')
        return
      }
      const hrs = typeof j.totalHours === 'number' ? j.totalHours.toFixed(2) : ''
      const d = j.entryDate ?? ''
      setMessage(
        hrs
          ? `Signed out. Added ${hrs} h to your timesheet for ${d} (Melbourne date).`
          : 'Signed out.',
      )
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">Loading…</div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Office attendance</h1>
        <p className="mt-2 text-sm text-slate-600">
          Site: <span className="font-medium text-slate-800">{selectedSite?.displayName ?? siteSlug}</span>
        </p>

        {!selectedSite ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No active office site matches this QR. Check the link or ask an admin to add site{' '}
            <code className="rounded bg-amber-100 px-1">{siteSlug}</code> in the database.
          </p>
        ) : !configured ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            This office site is not fully configured yet (client, location, work types). Either update{' '}
            <code className="rounded bg-red-100 px-1">office_clock_sites</code> for slug{' '}
            <code className="rounded bg-red-100 px-1">{siteSlug}</code> in Supabase, or set these in{' '}
            <code className="rounded bg-red-100 px-1">.env.local</code> (then restart the dev server):{' '}
            <code className="mt-1 block rounded bg-red-100 px-1 font-mono text-xs">
              OFFICE_CLOCK_CLIENT_ID, OFFICE_CLOCK_LOCATION_ID, OFFICE_CLOCK_WORK_TYPE_LEVEL1_ID,
              OFFICE_CLOCK_WORK_TYPE_LEVEL2_ID
            </code>
            <span className="mt-2 block text-xs text-red-800/90">
              On localhost, the server can auto-fill from the first client/location/work types in the database
              (development only). If that still fails, add seed data or the env vars above.
            </span>
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {openSession ? (
            <>
              <p className="text-sm text-slate-600">
                You are signed in since{' '}
                <span className="font-medium text-slate-900">
                  {new Date(openSession.clockInAt).toLocaleString('en-AU', {
                    timeZone: 'Australia/Melbourne',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>{' '}
                (Melbourne).
              </p>
              {isTechnician ? (
                <label className="mt-4 block text-sm text-slate-700">
                  <span className="mb-1.5 block font-medium text-slate-800">
                    What task were you working on?{' '}
                    <span className="font-normal text-slate-500">(optional)</span>
                  </span>
                  <select
                    value={fabTaskId}
                    onChange={e => setFabTaskId(e.target.value)}
                    disabled={busy}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  >
                    <option value="">Use office default fabrication task</option>
                    {fabTasks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                disabled={busy || !configured}
                onClick={() => void signOut()}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Sign out'}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || !selectedSite || !configured}
              onClick={() => void signIn()}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Sign in (morning)'}
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 border-t border-slate-100 pt-4 text-center text-sm text-slate-500 sm:flex-row sm:justify-center sm:gap-8">
          <Link
            href="/dashboard/timecards?tab=my"
            prefetch={false}
            className="inline-flex min-h-10 min-w-[12rem] items-center justify-center rounded-lg font-medium text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
          >
            Open my timecard
          </Link>
          <Link
            href="/dashboard"
            prefetch={false}
            className="inline-flex min-h-10 min-w-[10rem] items-center justify-center rounded-lg font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
