import Link from 'next/link'
import type { ClientPortalReportEntry } from '@/lib/client-portal/clientMaintenancePortal'
import { formatPortalDisplayDateYmd } from '@/lib/client-portal/clientMaintenancePortal'

function reportHref(e: ClientPortalReportEntry): string {
  const tok =
    e.kind === 'single'
      ? encodeURIComponent(e.shareToken)
      : encodeURIComponent(e.accessToken)
  return `/report/view/${tok}`
}

function reportTitle(e: ClientPortalReportEntry): string {
  if (e.kind === 'merged') {
    return e.clientName ? `Summary — ${e.clientName}` : 'Merged maintenance summary'
  }
  const parts = [e.locationLabel, e.address].filter(Boolean)
  return parts.length ? parts.join(' — ') : 'Maintenance inspection report'
}

export function ClientPortalReportSections({
  sections,
  compact,
}: {
  sections: { dateYmd: string; entries: ClientPortalReportEntry[] }[]
  compact?: boolean
}) {
  if (sections.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        No approved maintenance reports are available yet. When NBE shares a report with your organisation, it will
        appear here.
      </p>
    )
  }

  const shown = compact ? sections.slice(0, 6) : sections

  return (
    <div className="space-y-10">
      {shown.map(section => (
        <section key={section.dateYmd}>
          <h2 className="text-base font-semibold text-slate-900">
            {formatPortalDisplayDateYmd(section.dateYmd)}
          </h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
            {section.entries.map((e, idx) => (
              <li key={`${e.kind}-${e.id}-${idx}`}>
                <Link
                  href={reportHref(e)}
                  className="flex flex-col gap-1 px-4 py-3 text-sm transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-slate-900">{reportTitle(e)}</span>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    View PDF →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {compact && sections.length > shown.length ? (
        <p className="text-center text-sm text-slate-600">
          <Link href="/client/reports" className="font-semibold text-indigo-700 underline underline-offset-2">
            View all reports
          </Link>
        </p>
      ) : null}
    </div>
  )
}
