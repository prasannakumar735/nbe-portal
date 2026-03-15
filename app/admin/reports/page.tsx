'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ReportRow = {
  id: string
  technician_name: string
  inspection_date: string
  status: string
  submitted_at: string | null
  address: string | null
  location_name: string
  client_name: string
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchReports() {
      try {
        const res = await fetch('/api/admin/reports')
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (res.status === 401) {
            router.replace('/login')
            return
          }
          if (res.status === 403) {
            router.replace('/')
            return
          }
          setError(data.error ?? res.statusText)
          return
        }
        const data = await res.json()
        if (!cancelled) setReports(data.reports ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchReports()
    return () => { cancelled = true }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-slate-600">Loading reports…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
          <Link href="/dashboard" className="mt-4 inline-block text-slate-600 underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Reports (Admin)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Reports with status Submitted or Reviewing. Click a row to edit.
          </p>
        </header>

        {reports.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
            No submitted or reviewing reports.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-700">Technician</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Client / Location</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Inspection date</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/reports/${r.id}`}
                        className="block font-medium text-slate-900 underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {r.technician_name || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {[r.client_name, r.location_name].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.inspection_date || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === 'reviewing'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleDateString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4">
          <Link href="/dashboard" className="text-slate-600 underline hover:text-slate-900">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  )
}
