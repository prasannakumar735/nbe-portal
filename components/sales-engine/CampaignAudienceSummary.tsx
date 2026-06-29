'use client'

type CampaignAudienceSummaryProps = {
  selectedBusinesses: number
  selectedEmails: number
  loading?: boolean
}

export function CampaignAudienceSummary({
  selectedBusinesses,
  selectedEmails,
  loading = false,
}: CampaignAudienceSummaryProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Audience Summary</h2>
      <p className="mt-1 text-sm text-slate-600">Contacts selected from Sales Engine review.</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Selected Businesses
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">
            {loading ? '—' : selectedBusinesses}
          </dd>
        </div>
        <div className="rounded-xl bg-indigo-50 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-indigo-700">
            Selected Emails
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-indigo-900">
            {loading ? '—' : selectedEmails}
          </dd>
        </div>
      </dl>
    </section>
  )
}
