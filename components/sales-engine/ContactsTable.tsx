'use client'

import type { SalesContactDisplayRow } from '@/hooks/useContactDiscovery'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

const VERIFICATION_STYLES: Record<string, string> = {
  unknown: 'bg-slate-100 text-slate-700',
  valid: 'bg-emerald-100 text-emerald-800',
  invalid: 'bg-red-100 text-red-800',
  bounced: 'bg-orange-100 text-orange-800',
  blocked: 'bg-slate-200 text-slate-800',
}

type ContactsTableProps = {
  rows: SalesContactDisplayRow[]
  loading: boolean
  error: string | null
}

export function ContactsTable({ rows, loading, error }: ContactsTableProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Extracted Contacts</h2>
      <p className="mt-1 text-sm text-slate-600">
        Contacts discovered from selected business websites.
      </p>

      {error ? (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="mt-4">
          <LoadingSkeleton rows={2} />
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 font-medium text-slate-700">Company Name</th>
              <th className="px-3 py-2 font-medium text-slate-700">Email</th>
              <th className="px-3 py-2 font-medium text-slate-700">Phone</th>
              <th className="px-3 py-2 font-medium text-slate-700">Contact Type</th>
              <th className="px-3 py-2 font-medium text-slate-700">Confidence Score</th>
              <th className="px-3 py-2 font-medium text-slate-700">Verification Status</th>
              <th className="px-3 py-2 font-medium text-slate-700">Source</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                  No contacts yet. Select businesses and run Extract Contacts.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{row.company_name}</td>
                <td className="px-3 py-2 text-slate-700">{row.email ?? '—'}</td>
                <td className="px-3 py-2 text-slate-700">{row.phone ?? '—'}</td>
                <td className="px-3 py-2 capitalize text-slate-700">{row.contact_type}</td>
                <td className="px-3 py-2 text-slate-700">{row.confidence_score}%</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      VERIFICATION_STYLES[row.verification_status] ?? VERIFICATION_STYLES.unknown
                    }`}
                  >
                    {row.verification_status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
