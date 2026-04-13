'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { JobCardRow } from '@/lib/job-cards/types'

export default function JobCardHubPage() {
  const [jobs, setJobs] = useState<JobCardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/job-cards', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('Failed to load jobs')
        const json = (await res.json()) as { jobs: JobCardRow[] }
        if (!cancelled) setJobs(json.jobs ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-4 py-6 md:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Job cards</h1>
        <p className="mt-1 max-w-xl text-sm text-gray-500">
          Open a job from the calendar, or create a manual job when you are not on the schedule.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/calendar"
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
        >
          Go to calendar
        </Link>
        <Link
          href="/job-card/manual"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          New manual job
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}

      {!loading && !error && (
        <ul className="space-y-3">
          {jobs.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              No job cards yet. Start from an event on the calendar.
            </li>
          ) : (
            jobs.map(j => (
              <li key={j.id}>
                <Link
                  href={j.event_id ? `/job-card/${j.event_id}` : `/job-card/id/${j.id}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                >
                  <p className="font-semibold text-gray-900">{j.job_title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{j.status.replace('_', ' ')}</p>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
