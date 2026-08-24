'use client'

import { useMemo, useState } from 'react'
import type { ContactReviewGroup } from '@/hooks/useSelectedContacts'
import type { SalesContactDisplayRow } from '@/hooks/useContactDiscovery'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { outreachPriorityForContact } from '@/lib/sales/providers/contactOutreachRanking'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

// ── helpers ──────────────────────────────────────────────────────────────────

function emailDomain(email: string | null): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  return at < 0 ? null : email.slice(at + 1).toLowerCase()
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
  try { return new URL(url).hostname.replace(/^www\./i, '') } catch { return null }
}

function shortPageTitle(title: string | null): string | null {
  if (!title) return null
  const stripped = title.replace(/\s*[|\-–—]\s*.+$/, '').trim()
  return stripped || title
}

const VERIFICATION_STYLES: Record<string, string> = {
  unknown: 'bg-slate-100 text-slate-700',
  valid: 'bg-emerald-100 text-emerald-800',
  invalid: 'bg-red-100 text-red-800',
  bounced: 'bg-orange-100 text-orange-800',
  blocked: 'bg-slate-200 text-slate-800',
}

// ── re-group by email domain ──────────────────────────────────────────────────

type DomainGroup = {
  key: string          // email domain or 'unknown'
  label: string        // derived company label
  contacts: SalesContactDisplayRow[]
}

function groupByEmailDomain(groups: ContactReviewGroup[]): DomainGroup[] {
  const map = new Map<string, DomainGroup>()
  for (const g of groups) {
    for (const c of g.contacts) {
      const domain = emailDomain(c.email) ?? 'unknown'
      const label = domain !== 'unknown' ? domainToCompanyLabel(domain) : 'Unknown'
      const existing = map.get(domain)
      if (existing) {
        existing.contacts.push(c)
      } else {
        map.set(domain, { key: domain, label, contacts: [c] })
      }
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}

// ── types ─────────────────────────────────────────────────────────────────────

type ContactReviewTableProps = {
  groups: ContactReviewGroup[]
  loading: boolean
  recommendedIds: Set<string>
  isSelected: (contactId: string) => boolean
  onToggleContact: (contactId: string) => void
  onSelectAllCompany: (businessId: string) => void
  onUnselectAllCompany: (businessId: string) => void
}

// ── component ─────────────────────────────────────────────────────────────────

export function ContactReviewTable({
  groups,
  loading,
  recommendedIds,
  isSelected,
  onToggleContact,
}: ContactReviewTableProps) {
  const [pageSize, setPageSize] = useState<number>(10)
  const [customPageSize, setCustomPageSize] = useState('')
  const [page, setPage] = useState(0)

  const domainGroups = useMemo(() => groupByEmailDomain(groups), [groups])

  // Flatten all contacts for pagination
  const allContacts = useMemo(
    () => domainGroups.flatMap((g) => g.contacts.map((c) => ({ ...c, _groupLabel: g.label }))),
    [domainGroups],
  )

  const effectivePageSize = useMemo(() => {
    const custom = parseInt(customPageSize, 10)
    return !isNaN(custom) && custom > 0 ? custom : pageSize
  }, [pageSize, customPageSize])

  const totalPages = Math.max(1, Math.ceil(allContacts.length / effectivePageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageStart = safePage * effectivePageSize
  const pageEnd = pageStart + effectivePageSize

  // Slice domain groups to only show contacts that fall within the current page window
  const visibleGroups = useMemo(() => {
    let idx = 0
    const result: { label: string; key: string; contacts: (SalesContactDisplayRow & { _groupLabel: string })[] }[] = []
    for (const g of domainGroups) {
      const gStart = idx
      const gEnd = idx + g.contacts.length
      idx = gEnd
      if (gEnd <= pageStart || gStart >= pageEnd) continue
      const sliceStart = Math.max(0, pageStart - gStart)
      const sliceEnd = Math.min(g.contacts.length, pageEnd - gStart)
      result.push({
        label: g.label,
        key: g.key,
        contacts: g.contacts.slice(sliceStart, sliceEnd).map((c) => ({ ...c, _groupLabel: g.label })),
      })
    }
    return result
  }, [domainGroups, pageStart, pageEnd])

  function handlePageSizeChange(val: number) {
    setPageSize(val); setCustomPageSize(''); setPage(0)
  }
  function handleCustomPageSize(val: string) {
    setCustomPageSize(val); setPage(0)
  }

  const hasGroups = groups.length > 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Contact Review</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose which email addresses will receive the outreach campaign. Recommended contacts are
        pre-selected; you can change the selection anytime.
        {allContacts.length > 0 && (
          <span className="ml-1 text-slate-400">{allContacts.length} total</span>
        )}
      </p>

      {loading && !hasGroups ? (
        <div className="mt-4"><LoadingSkeleton rows={2} /></div>
      ) : null}

      {!loading && !hasGroups ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Extract contacts from selected businesses to review emails here.
        </p>
      ) : null}

      {hasGroups && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-10 px-3 py-2"><span className="sr-only">Select</span></th>
                  <th className="px-3 py-2 font-medium text-slate-700">Email Address</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Company</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Type</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Confidence</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Priority</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Status</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Page URL</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Page Title</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((g) => {
                  const groupContacts = domainGroups.find((dg) => dg.key === g.key)?.contacts ?? []
                  const selectedInGroup = groupContacts.filter((c) => isSelected(c.id)).length
                  const allGroupSelected = selectedInGroup === groupContacts.length && groupContacts.length > 0

                  return [
                    // Company section header row
                    <tr key={`hdr-${g.key}`} className="bg-slate-50 border-b border-slate-200">
                      <td colSpan={9} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 text-sm">{g.label}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={allGroupSelected}
                              onClick={() => groupContacts.filter(c => !isSelected(c.id)).forEach(c => onToggleContact(c.id))}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              disabled={selectedInGroup === 0}
                              onClick={() => groupContacts.filter(c => isSelected(c.id)).forEach(c => onToggleContact(c.id))}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                            >
                              Clear all
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>,
                    // Contact rows
                    ...g.contacts.map((contact) => {
                      const outreachPriority = outreachPriorityForContact({
                        id: contact.id,
                        business_id: contact.business_id,
                        email: contact.email,
                        contact_type: contact.contact_type,
                        confidence_score: contact.confidence_score,
                        recommended_for_outreach: contact.recommended_for_outreach,
                        page_kind: contact.page_kind,
                        discovery_method: contact.discovery_method,
                      })
                      return (
                        <tr key={contact.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="px-3 py-2 align-top">
                            <input
                              type="checkbox"
                              checked={isSelected(contact.id)}
                              onChange={() => onToggleContact(contact.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              aria-label={`Include ${contact.email} in campaign`}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            <span>{contact.email}</span>
                            {recommendedIds.has(contact.id) && (
                              <span className="ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Recommended</span>
                            )}
                            {contact.is_primary && (
                              <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Primary</span>
                            )}
                            {contact.recommended_reason && (
                              <p className="mt-1 text-xs font-normal text-slate-500">{contact.recommended_reason}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">{g.label}</td>
                          <td className="px-3 py-2 capitalize text-slate-700">{contact.contact_type}</td>
                          <td className="px-3 py-2 text-slate-700">{contact.confidence_score}%</td>
                          <td className="px-3 py-2 text-slate-700">{outreachPriority}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${VERIFICATION_STYLES[contact.verification_status] ?? VERIFICATION_STYLES.unknown}`}>
                              {contact.verification_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {contact.contact_page ? (
                              <a href={contact.contact_page} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline" title={contact.contact_page}>
                                {pageUrlDomain(contact.contact_page) ?? contact.contact_page}
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            <div className="max-w-[10rem] truncate text-xs sm:max-w-xs" title={contact.discovery_page_title ?? undefined}>
                              {shortPageTitle(contact.discovery_page_title) ?? '—'}
                            </div>
                          </td>
                        </tr>
                      )
                    }),
                  ]
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {allContacts.length > 0 && (
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
                  {pageStart + 1}–{Math.min(pageEnd, allContacts.length)} of {allContacts.length}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={safePage === 0} onClick={() => setPage(0)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="First">
                    <span className="material-symbols-outlined text-[16px]">first_page</span>
                  </button>
                  <button type="button" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Previous">
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  <span className="px-1 text-xs">Page {safePage + 1} of {totalPages}</span>
                  <button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Next">
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                  <button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Last">
                    <span className="material-symbols-outlined text-[16px]">last_page</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
