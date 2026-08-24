'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { JobCardRow } from '@/lib/job-cards/types';

type PvcJobCard = {
  id: string
  customer_name: string | null
  ref_no: string | null
  workflow_status: string
  job_card_created_at: string | null
  job_card_supply_scope: string | null
  approval_po_reference: string | null
  approval_message: string | null
}

function PvcJobCardsList() {
  const [items, setItems] = useState<PvcJobCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/pvc/quotes/my-job-cards', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('Failed to load PVC job cards')
        const json = await res.json() as { quotes: PvcJobCard[]; isManager: boolean }
        if (!cancelled) {
          setItems(json.quotes ?? [])
          setIsManager(json.isManager)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
  if (error) return <p className="text-sm text-rose-700">{error}</p>

  return (
    <div>
      {isManager && (
        <p className="mb-3 text-xs text-slate-500">Showing all approved PVC quotes (manager view).</p>
      )}
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          No PVC job cards assigned to you yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map(q => (
            <li key={q.id}>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-semibold text-slate-900">{q.customer_name || 'Unnamed customer'}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    {q.ref_no && <span>Ref: {q.ref_no}</span>}
                    {q.approval_po_reference && <span>PO: {q.approval_po_reference}</span>}
                    <span className={`inline-flex rounded-full px-2 py-0.5 font-medium capitalize ${
                      q.workflow_status === 'shipped_or_installed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {q.workflow_status === 'shipped_or_installed' ? 'Shipped / installed' : 'Approved'}
                    </span>
                    {q.job_card_supply_scope && (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-700">
                        {q.job_card_supply_scope === 'whole_door' ? 'Whole door' : 'Strips only'}
                      </span>
                    )}
                    {q.job_card_created_at && (
                      <span>{new Date(q.job_card_created_at).toLocaleDateString('en-AU')}</span>
                    )}
                  </div>
                  {q.approval_message && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-1">{q.approval_message}</p>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/pvc-calculator/${q.id}/edit`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View quote
                  </Link>
                  <a
                    href={`/api/pvc/quotes/${q.id}/job-card/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Print job card
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function JobCardHubPage() {
  const [jobs, setJobs] = useState<JobCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/job-cards', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to load jobs');
        const json = (await res.json()) as { jobs: JobCardRow[] };
        if (!cancelled) setJobs(json.jobs ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-4 py-6 md:px-6 space-y-10">

      {/* ── PVC Strip Curtain Job Cards ── */}
      <section>
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">PVC Strip Curtain Job Cards</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Approved quotes assigned to you — download the job card PDF and view quote details.
          </p>
        </header>
        <PvcJobCardsList />
      </section>

      <div className="border-t border-slate-200" />

      {/* ── Field / Calendar Job Cards ── */}
      <section>
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Field Job Cards</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Open a job from the calendar, or create a manual job when you are not on the schedule.
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/calendar" className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50">
            Go to calendar
          </Link>
          <Link href="/job-card/manual" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
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
      </section>
    </div>
  );
}
