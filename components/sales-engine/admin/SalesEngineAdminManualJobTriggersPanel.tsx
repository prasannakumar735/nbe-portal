'use client'

import { useCallback, useState } from 'react'

type RunJobId = 'email-send' | 'followup-dispatch' | 'jobs' | 'all'

type JobButton = {
  id: RunJobId
  label: string
}

const JOB_BUTTONS: JobButton[] = [
  { id: 'email-send', label: 'Send queued emails' },
  { id: 'followup-dispatch', label: 'Dispatch follow-ups' },
  { id: 'jobs', label: 'Run background jobs' },
  { id: 'all', label: 'Run all' },
]

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-indigo-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function formatJobResult(job: RunJobId, result: unknown): string {
  if (result == null || typeof result !== 'object') {
    return 'Completed'
  }

  if (job === 'email-send') {
    const r = result as { results?: { outcome: string }[]; recoveredStuck?: number }
    const sent = r.results?.filter((x) => x.outcome === 'sent').length ?? 0
    const processed = r.results?.length ?? 0
    const stuck = r.recoveredStuck ?? 0
    const parts = [`Sent ${sent} email${sent === 1 ? '' : 's'}`]
    if (processed > sent) parts.push(`${processed} processed`)
    if (stuck > 0) parts.push(`${stuck} stuck item${stuck === 1 ? '' : 's'} recovered`)
    return parts.join('; ')
  }

  if (job === 'followup-dispatch') {
    const r = result as { results?: { outcome: string }[] }
    const n = r.results?.length ?? 0
    const reviewed = r.results?.filter((x) => x.outcome === 'awaiting_review').length ?? 0
    return `Dispatched ${n} follow-up${n === 1 ? '' : 's'} (${reviewed} awaiting review)`
  }

  if (job === 'jobs') {
    const rows = Array.isArray(result) ? result : []
    const completed = rows.filter((x) => x && typeof x === 'object' && (x as { status?: string }).status === 'completed').length
    const failed = rows.filter((x) => x && typeof x === 'object' && (x as { status?: string }).status === 'failed').length
    return `Ran ${rows.length} job${rows.length === 1 ? '' : 's'} (${completed} completed, ${failed} failed)`
  }

  if (job === 'all') {
    const r = result as {
      emailSend?: { results?: { outcome: string }[] }
      followup?: { results?: unknown[] }
      jobs?: unknown[]
    }
    const sent = r.emailSend?.results?.filter((x) => x.outcome === 'sent').length ?? 0
    const followups = r.followup?.results?.length ?? 0
    const bgJobs = Array.isArray(r.jobs) ? r.jobs.length : 0
    return `All jobs finished — ${sent} sent, ${followups} follow-ups, ${bgJobs} background jobs`
  }

  return 'Completed'
}

export function SalesEngineAdminManualJobTriggersPanel() {
  const [running, setRunning] = useState<RunJobId | null>(null)
  const [messages, setMessages] = useState<Partial<Record<RunJobId, { text: string; error?: boolean }>>>({})

  const runJob = useCallback(async (job: RunJobId) => {
    setRunning(job)
    setMessages((prev) => {
      const next = { ...prev }
      delete next[job]
      return next
    })
    try {
      const res = await fetch('/api/sales/admin/run-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      })
      const json = (await res.json()) as { ok: boolean; result?: unknown; error?: string }
      if (!json.ok) {
        setMessages((prev) => ({
          ...prev,
          [job]: { text: json.error || 'Request failed', error: true },
        }))
        return
      }
      setMessages((prev) => ({
        ...prev,
        [job]: { text: formatJobResult(job, json.result) },
      }))
    } catch (e) {
      setMessages((prev) => ({
        ...prev,
        [job]: {
          text: e instanceof Error ? e.message : 'Request failed',
          error: true,
        },
      }))
    } finally {
      setRunning(null)
    }
  }, [])

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {JOB_BUTTONS.map(({ id, label }) => {
          const isRunning = running === id
          const message = messages[id]
          return (
            <li
              key={id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{label}</p>
                {message ? (
                  <p
                    className={`mt-1 text-xs ${message.error ? 'text-red-700' : 'text-slate-600'}`}
                    role={message.error ? 'alert' : undefined}
                  >
                    {message.text}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={running !== null}
                onClick={() => void runJob(id)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Spinner />
                    Running…
                  </>
                ) : (
                  'Run'
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
