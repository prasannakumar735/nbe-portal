'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin, Camera, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useJobCard, useJobCardById } from '@/hooks/useJobCard'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useReverseGeocoding } from '@/hooks/useReverseGeocoding'
import { useStartJob } from '@/hooks/useStartJob'
import { useCompleteJob } from '@/hooks/useCompleteJob'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useSuggestedArticles } from '@/hooks/useSuggestedArticles'
import { formatJobGpsForReport } from '@/lib/job-cards/reportFormat'
import { enqueueJobImage, enqueueJobPatch } from '@/lib/offline/fieldSyncDb'
import { SignaturePad } from '@/components/job-card/SignaturePad'

function formatDurationFromIso(start: string | null, end: string | null) {
  if (!start || !end) return '—'
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—'
  const m = Math.round((b - a) / 60000)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`
}

const BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-900 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-900 ring-sky-200',
  completed: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
}

type Props = {
  eventId?: string
  jobId?: string
}

export function JobCardScreen({ eventId, jobId }: Props) {
  const byEvent = useJobCard(eventId ?? null)
  const byId = useJobCardById(jobId ?? null)
  const { data, loading, error, reload } = jobId ? byId : byEvent
  const { getCurrentPosition, loading: geoLoading } = useGeolocation()
  const { reverse, loading: revLoading } = useReverseGeocoding()
  const { startJob, loading: startLoading } = useStartJob()
  const { completeJob, loading: completeLoading } = useCompleteJob()
  const { online, pending, syncing, sync, lastError } = useOfflineQueue()

  const job = data?.job
  const labels = data?.labels
  const cal = data?.calendar

  const suggested = useSuggestedArticles(job?.job_title, job?.work_type)

  const [notes, setNotes] = useState('')
  const [notesTouched, setNotesTouched] = useState(false)

  useEffect(() => {
    if (!notesTouched) setNotes(job?.notes ?? '')
  }, [job?.id, job?.notes, job?.updated_at, notesTouched])

  const notesDirty = useMemo(() => notes !== (job?.notes ?? ''), [notes, job?.notes])

  const saveNotes = useCallback(async () => {
    if (!job?.id || !notesDirty) return
    try {
      if (!online) {
        await enqueueJobPatch(job.id, { notes })
        toast.message('Saved offline — will sync when online')
        return
      }
      const res = await fetch(`/api/job-cards/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Notes saved')
      setNotesTouched(false)
      await reload()
    } catch {
      toast.error('Could not save notes')
    }
  }, [job?.id, notes, notesDirty, online, reload])

  const onStart = async () => {
    if (!job?.id) return
    try {
      const r = await startJob({
        jobId: job.id,
        getPosition: () => getCurrentPosition(),
        reverse: (la, ln) => reverse(la, ln),
        onQueued: () => toast.message('Queued offline — will sync when online'),
      })
      if (r?.offline) await sync().catch(() => {})
      toast.success('Job started')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Start failed')
    }
  }

  const onComplete = async () => {
    if (!job?.id) return
    try {
      const r = await completeJob({
        jobId: job.id,
        notes: notes || job.notes || null,
        getPosition: () => getCurrentPosition(),
        reverse: (la, ln) => reverse(la, ln),
        onQueued: () => toast.message('Queued offline — will sync when online'),
      })
      if (r?.offline) await sync().catch(() => {})
      toast.success('Job completed')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Complete failed')
    }
  }

  const onPickImage = async (file: File | null) => {
    if (!file || !job?.id) return
    try {
      if (!online) {
        await enqueueJobImage(job.id, file)
        toast.message('Photo queued for upload when online')
        await sync().catch(() => {})
        return
      }
      const fd = new FormData()
      fd.set('job_card_id', job.id)
      fd.set('file', file)
      const res = await fetch('/api/job-cards/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
      if (!res.ok) throw new Error('Upload failed')
      toast.success('Photo added')
      await reload()
    } catch {
      toast.error('Photo upload failed')
    }
  }

  const onSignature = async (blob: Blob) => {
    if (!job?.id) return
    try {
      const file = new File([blob], 'signature.png', { type: 'image/png' })
      if (!online) {
        await enqueueJobImage(job.id, file, { asSignature: true, filename: 'signature.png' })
        toast.message('Signature queued for upload when online')
        return
      }
      const fd = new FormData()
      fd.set('job_card_id', job.id)
      fd.set('file', file)
      fd.set('as_signature', '1')
      const res = await fetch('/api/job-cards/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
      if (!res.ok) throw new Error('Upload failed')
      toast.success('Signature saved')
      await reload()
    } catch {
      toast.error('Signature upload failed')
    }
  }

  const reportGps = formatJobGpsForReport(job?.gps_start_address, job?.gps_end_address)

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-gray-600">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
        <p className="text-sm font-medium">Loading job…</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-900">
        {error ?? 'Job card unavailable.'}
      </div>
    )
  }

  const travelMin = cal?.travel_minutes ?? 0
  const workMin = cal?.work_minutes ?? cal?.duration_minutes ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden pb-28">
      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          <span>Offline mode. Actions queue locally{pending ? ` (${pending} pending)` : ''}.</span>
        </div>
      )}
      {lastError && online && (
        <p className="mb-2 text-xs text-rose-600" role="alert">
          Sync: {lastError}
        </p>
      )}
      {syncing && <p className="mb-2 text-xs text-gray-500">Syncing…</p>}

      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Job</p>
        <h1 className="mt-1 text-xl font-semibold leading-snug text-gray-900">{job.job_title}</h1>
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          {labels?.client_name && (
            <p>
              <span className="font-medium text-gray-700">Client</span> · {labels.client_name}
            </p>
          )}
          {(labels?.location_label || job.job_description) && (
            <p className="flex gap-1.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <span>{labels?.location_label || job.job_description}</span>
            </p>
          )}
        </div>
      </header>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${BADGE[job.status] ?? BADGE.pending}`}
          >
            {job.status.replace('_', ' ')}
          </span>
          {workMin != null && (
            <span className="text-xs text-gray-500">
              Scheduled work ~{workMin} min
              {travelMin > 0 ? ` · Travel ~${travelMin} min (rt)` : ''}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Work duration</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
              {formatDurationFromIso(job.start_time, job.end_time)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Travel (schedule)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{travelMin > 0 ? `${travelMin} min` : '—'}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Location (reports)</h2>
        <p className="mt-2 text-sm text-gray-700">{reportGps === '—' ? 'Captured when you start and complete the job.' : reportGps}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Technician notes</h2>
        <textarea
          value={notes}
          onChange={e => {
            setNotesTouched(true)
            setNotes(e.target.value)
          }}
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="On-site findings, parts, follow-up…"
        />
        <button
          type="button"
          onClick={() => void saveNotes()}
          disabled={!notesDirty}
          className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save notes
        </button>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Photos</h2>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-white">
          <Camera className="h-5 w-5 text-gray-500" aria-hidden />
          <span>Add photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={e => void onPickImage(e.target.files?.[0] ?? null)}
          />
        </label>
        {data?.images?.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.images.map(img => (
              <li key={img.id} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt="" className="h-28 w-full object-cover" />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {job.status !== 'completed' && (
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Signature</h2>
          <p className="mt-1 text-xs text-gray-500">Optional — captured as an image.</p>
          <SignaturePad className="mt-3" onCapture={blob => void onSignature(blob)} disabled={completeLoading} />
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Suggested fixes</h2>
        {suggested.loading ? (
          <p className="mt-2 text-sm text-gray-500">Finding articles…</p>
        ) : suggested.articles.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No matches for this job title yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {suggested.articles.map(a => (
              <li key={a.id}>
                <Link
                  href={`/knowledge/${a.id}`}
                  className="block rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-white hover:shadow-sm"
                >
                  {a.title}
                  <span className="ml-2 text-xs font-normal text-gray-500">{a.category}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur md:static md:pointer-events-auto md:mt-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <div className="pointer-events-auto mx-auto flex max-w-lg flex-col gap-2">
          {job.status === 'pending' && (
            <button
              type="button"
              onClick={() => void onStart()}
              disabled={startLoading || geoLoading || revLoading}
              className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {startLoading || geoLoading || revLoading ? 'Getting location…' : 'Start job'}
            </button>
          )}
          {job.status === 'in_progress' && (
            <button
              type="button"
              onClick={() => void onComplete()}
              disabled={completeLoading || geoLoading || revLoading}
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {completeLoading || geoLoading || revLoading ? 'Getting location…' : 'Complete job'}
            </button>
          )}
          {job.status === 'completed' && (
            <p className="text-center text-sm font-medium text-emerald-800">Job completed</p>
          )}
        </div>
      </div>
    </div>
  )
}
