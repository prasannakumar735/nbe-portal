'use client'

import { useState, useMemo } from 'react'
import type { SalesContactDisplayRow } from '@/hooks/useContactDiscovery'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

const VERIFICATION_STYLES: Record<string, string> = {
  unknown: 'bg-slate-100 text-slate-700',
  valid: 'bg-emerald-100 text-emerald-800',
  invalid: 'bg-red-100 text-red-800',
  bounced: 'bg-orange-100 text-orange-800',
  blocked: 'bg-slate-200 text-slate-800',
}

const CONTACT_TYPE_OPTIONS = ['all', 'sales', 'general', 'unknown'] as const
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

function emailDomain(email: string | null): string | null {
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

function pageUrlDomain(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return null
  }
}

type ContactsTableProps = {
  rows: SalesContactDisplayRow[]
  loading: boolean
  error: string | null
}

export function ContactsTable({ rows, loading, error }: ContactsTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [minConfidence, setMinConfidence] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [pageSize, setPageSize] = useState<number>(10)
  const [customPageSize, setCustomPageSize] = useState('')
  const [page, setPage] = useState(0)

  const effectivePageSize = useMemo(() => {
    const custom = parseInt(customPageSize, 10)
    return !isNaN(custom) && custom > 0 ? custom : pageSize
  }, [pageSize, customPageSize])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.contact_type !== typeFilter) return false
      if (r.confidence_score < minConfidence) return false
      return true
    })
  }, [rows, typeFilter, minConfidence])

  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(safePage * effectivePageSize, (safePage + 1) * effectivePageSize)

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Extracted Contacts</h2>
          <p className="mt-1 text-sm text-slate-600">
            Contacts discovered from selected business websites.{' '}
            {rows.length > 0 && (
              <span className="text-slate-400">
                {filtered.length === rows.length
                  ? `${rows.length} total`
                  : `${filtered.length} of ${rows.length} shown`}
              </span>
            )}
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[16px]">filter_list</span>
            Filters
            {(typeFilter !== 'all' || minConfidence > 0) && (
              <span className="ml-1 h-2 w-2 rounded-full bg-indigo-500" />
            )}
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Contact type</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
            >
              {CONTACT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">
              Min confidence: <span className="font-semibold text-slate-800">{minConfidence}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={95}
              step={5}
              value={minConfidence}
              onChange={(e) => { setMinConfidence(Number(e.target.value)); setPage(0) }}
              className="w-28 accent-indigo-600"
            />
          </div>
          {(typeFilter !== 'all' || minConfidence > 0) && (
            <button
              type="button"
              onClick={() => { setTypeFilter('all'); setMinConfidence(0); setPage(0) }}
              className="text-xs text-indigo-600 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      )}

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
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 font-medium text-slate-700">Contact Company</th>
              <th className="px-3 py-2 font-medium text-slate-700">Email</th>
              <th className="px-3 py-2 font-medium text-slate-700">Phone</th>
              <th className="px-3 py-2 font-medium text-slate-700">Type</th>
              <th className="px-3 py-2 font-medium text-slate-700">Confidence</th>
              <th className="px-3 py-2 font-medium text-slate-700">Status</th>
              <th className="px-3 py-2 font-medium text-slate-700">Found On</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                  {rows.length === 0
                    ? 'No contacts yet. Select businesses and run Extract Contacts.'
                    : 'No contacts match the current filters.'}
                </td>
              </tr>
            ) : null}
            {paginated.map((row) => {
              const domain = emailDomain(row.email)
              const companyLabel = domain ? domainToCompanyLabel(domain) : null
              const sourceDomain = pageUrlDomain(row.contact_page)
              const isOwnDomain = domain && sourceDomain && domain === sourceDomain
              return (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{companyLabel ?? row.company_name}</p>
                    {!isOwnDomain && companyLabel && row.company_name && row.company_name !== '—' && companyLabel.toLowerCase() !== row.company_name.toLowerCase() && (
                      <p className="mt-0.5 text-[11px] text-slate-400">via {row.company_name}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.email ? (
                      <a
                        href={`mailto:${row.email}`}
                        className="hover:text-indigo-600 hover:underline"
                      >
                        {row.email}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.phone ?? '—'}</td>
                  <td className="px-3 py-2 capitalize text-slate-700">{row.contact_type}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            row.confidence_score >= 80
                              ? 'bg-emerald-500'
                              : row.confidence_score >= 60
                              ? 'bg-amber-400'
                              : 'bg-slate-400'
                          }`}
                          style={{ width: `${row.confidence_score}%` }}
                        />
                      </div>
                      <span className="text-slate-600">{row.confidence_score}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        VERIFICATION_STYLES[row.verification_status] ?? VERIFICATION_STYLES.unknown
                      }`}
                    >
                      {row.verification_status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.contact_page ? (
                      <a
                        href={row.contact_page}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 hover:text-indigo-600 hover:underline"
                        title={row.contact_page}
                      >
                        {sourceDomain ?? 'link'}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">{row.source}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {filtered.length > 0 && (
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
              {safePage * effectivePageSize + 1}–{Math.min((safePage + 1) * effectivePageSize, filtered.length)} of {filtered.length}
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
