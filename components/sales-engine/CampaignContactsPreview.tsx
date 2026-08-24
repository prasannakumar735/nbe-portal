'use client'

import { useState, useMemo } from 'react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import type { CampaignContactPreviewRow } from '@/hooks/useCampaignBuilder'

const VERIFICATION_STYLES: Record<string, string> = {
  unknown: 'bg-slate-100 text-slate-700',
  valid: 'bg-emerald-100 text-emerald-800',
  invalid: 'bg-red-100 text-red-800',
  bounced: 'bg-orange-100 text-orange-800',
  blocked: 'bg-slate-200 text-slate-800',
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  if (at < 0) return null
  return email.slice(at + 1).toLowerCase()
}

function domainToCompanyLabel(domain: string): string {
  const clean = domain.replace(/^www\./i, '')
  const name = clean
    .replace(/\.(com\.au|net\.au|org\.au|gov\.au|edu\.au|asn\.au|id\.au|com|net|org|io|co\.uk|co\.nz)$/i, '')
    .replace(/\.(co|ac|gov|edu|sch)$/, '')
  return name
    .split(/[-.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

type CampaignContactsPreviewProps = {
  rows: CampaignContactPreviewRow[]
  loading: boolean
  error: string | null
}

export function CampaignContactsPreview({ rows, loading, error }: CampaignContactsPreviewProps) {
  const [pageSize, setPageSize] = useState<number>(10)
  const [customPageSize, setCustomPageSize] = useState('')
  const [page, setPage] = useState(0)

  const effectivePageSize = useMemo(() => {
    const custom = parseInt(customPageSize, 10)
    return !isNaN(custom) && custom > 0 ? custom : pageSize
  }, [pageSize, customPageSize])

  const totalPages = Math.max(1, Math.ceil(rows.length / effectivePageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = rows.slice(safePage * effectivePageSize, (safePage + 1) * effectivePageSize)

  function handlePageSizeChange(val: number) {
    setPageSize(val)
    setCustomPageSize('')
    setPage(0)
  }

  function handleCustomPageSize(val: string) {
    setCustomPageSize(val)
    setPage(0)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Selected Contacts Preview</h2>
          <p className="mt-1 text-sm text-slate-600">
            Emails that will be included in this campaign.{' '}
            {rows.length > 0 && (
              <span className="text-slate-400">{rows.length} total</span>
            )}
          </p>
        </div>
      </div>

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
              <th className="px-3 py-2 font-medium text-slate-700">Email Address</th>
              <th className="px-3 py-2 font-medium text-slate-700">Contact Type</th>
              <th className="px-3 py-2 font-medium text-slate-700">Confidence</th>
              <th className="px-3 py-2 font-medium text-slate-700">Status</th>
              <th className="px-3 py-2 font-medium text-slate-700">Source</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                  No contacts loaded. Return to Sales Engine and select emails first.
                </td>
              </tr>
            ) : null}
            {paginated.map((row) => {
              const domain = emailDomain(row.email)
              const derivedLabel = domain ? domainToCompanyLabel(domain) : null
              const displayName = derivedLabel ?? row.company_name
              const showVia =
                derivedLabel &&
                row.company_name &&
                derivedLabel.toLowerCase() !== row.company_name.toLowerCase()
              return (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{displayName}</p>
                    {showVia && (
                      <p className="mt-0.5 text-[11px] text-slate-400">via {row.company_name}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.email ?? '—'}</td>
                  <td className="px-3 py-2 capitalize text-slate-700">{row.contact_type}</td>
                  <td className="px-3 py-2 text-slate-700">{row.confidence_score}%</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        VERIFICATION_STYLES[row.verification_status] ??
                        VERIFICATION_STYLES.unknown
                      }`}
                    >
                      {row.verification_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.source}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {rows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Rows per page:</span>
            <div className="flex items-center gap-1">
              {PAGE_SIZE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handlePageSizeChange(s)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    effectivePageSize === s && !customPageSize
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
              <input
                type="number"
                min={1}
                placeholder="Custom"
                value={customPageSize}
                onChange={(e) => handleCustomPageSize(e.target.value)}
                className="w-16 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {safePage * effectivePageSize + 1}–{Math.min((safePage + 1) * effectivePageSize, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(0)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                title="First page"
              >
                <span className="material-symbols-outlined text-[16px]">first_page</span>
              </button>
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                title="Previous page"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <span className="px-1 text-xs">
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                title="Next page"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                title="Last page"
              >
                <span className="material-symbols-outlined text-[16px]">last_page</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
