'use client'

import type { ContactReviewGroup } from '@/hooks/useSelectedContacts'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { outreachPriorityForContact } from '@/lib/sales/providers/contactOutreachRanking'

function pageUrlDomain(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return null
  }
}

function shortPageTitle(title: string | null): string | null {
  if (!title) return null
  // Strip trailing " | Site Name" or " - Site Name" (keep just the section label)
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

type ContactReviewTableProps = {
  groups: ContactReviewGroup[]
  loading: boolean
  recommendedIds: Set<string>
  isSelected: (contactId: string) => boolean
  onToggleContact: (contactId: string) => void
  onSelectAllCompany: (businessId: string) => void
  onUnselectAllCompany: (businessId: string) => void
}

export function ContactReviewTable({
  groups,
  loading,
  recommendedIds,
  isSelected,
  onToggleContact,
  onSelectAllCompany,
  onUnselectAllCompany,
}: ContactReviewTableProps) {
  const hasGroups = groups.length > 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Contact Review</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose which email addresses will receive the outreach campaign. Recommended contacts are
        pre-selected; you can change the selection anytime.
      </p>

      {loading && !hasGroups ? (
        <div className="mt-4">
          <LoadingSkeleton rows={2} />
        </div>
      ) : null}

      {!loading && !hasGroups ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Extract contacts from selected businesses to review emails here.
        </p>
      ) : null}

      <div className="mt-4 space-y-6">
        {groups.map((group) => {
          const selectedInGroup = group.contacts.filter((c) => isSelected(c.id)).length
          const allSelected = selectedInGroup === group.contacts.length && group.contacts.length > 0
          return (
            <div
              key={group.business_id}
              className="overflow-hidden rounded-xl border border-slate-200"
            >
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold text-slate-900">{group.company_name}</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    disabled={allSelected}
                    onClick={() => onSelectAllCompany(group.business_id)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={selectedInGroup === 0}
                    onClick={() => onUnselectAllCompany(group.business_id)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-white">
                      <th className="w-10 px-3 py-2" scope="col">
                        <span className="sr-only">Include in campaign</span>
                      </th>
                      <th className="px-3 py-2 font-medium text-slate-700">Email Address</th>
                      <th className="px-3 py-2 font-medium text-slate-700">Contact Type</th>
                      <th className="px-3 py-2 font-medium text-slate-700">Confidence</th>
                      <th className="px-3 py-2 font-medium text-slate-700">Outreach Priority</th>
                      <th className="px-3 py-2 font-medium text-slate-700">Verification Status</th>
                      <th className="px-3 py-2 font-medium text-slate-700">Page URL</th>
                      <th className="px-3 py-2 font-medium text-slate-700">Page Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.contacts.map((contact) => {
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
                      <tr key={contact.id} className="border-b border-slate-50 last:border-0">
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
                          {recommendedIds.has(contact.id) ? (
                            <span className="ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                              Recommended
                            </span>
                          ) : null}
                          {contact.is_primary ? (
                            <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              Primary
                            </span>
                          ) : null}
                          {contact.recommended_reason ? (
                            <p className="mt-1 text-xs font-normal text-slate-500">
                              {contact.recommended_reason}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 capitalize text-slate-700">{contact.contact_type}</td>
                        <td className="px-3 py-2 text-slate-700">{contact.confidence_score}%</td>
                        <td className="px-3 py-2 text-slate-700">{outreachPriority}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              VERIFICATION_STYLES[contact.verification_status] ??
                              VERIFICATION_STYLES.unknown
                            }`}
                          >
                            {contact.verification_status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {contact.contact_page ? (
                            <a
                              href={contact.contact_page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline"
                              title={contact.contact_page}
                            >
                              {pageUrlDomain(contact.contact_page) ?? contact.contact_page}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <div
                            className="max-w-[10rem] truncate text-xs sm:max-w-xs"
                            title={contact.discovery_page_title ?? undefined}
                          >
                            {shortPageTitle(contact.discovery_page_title) ?? '—'}
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
