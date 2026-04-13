'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ManualJobPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [workType, setWorkType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const t = title.trim()
    if (!t) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/job-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          is_manual: true,
          job_title: t,
          work_type: workType.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || 'Create failed')
      }
      const json = (await res.json()) as { job: { id: string } }
      router.push(`/job-card/id/${json.job.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900">Manual job</h1>
      <p className="mt-1 text-sm text-gray-500">Creates a job card without a calendar event. Client and site can be edited later from the job record.</p>

      <label className="mt-6 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Job title</span>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="e.g. Gate service — Acme Co"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Work type (optional)</span>
        <input
          value={workType}
          onChange={e => setWorkType(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="Helps match knowledge articles"
        />
      </label>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving}
        className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create job card'}
      </button>
    </div>
  )
}
