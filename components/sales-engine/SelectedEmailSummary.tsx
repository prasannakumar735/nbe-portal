'use client'

type SelectedEmailSummaryProps = {
  businessesSelected: number
  emailsExtracted: number
  emailsSelectedForCampaign: number
  loading?: boolean
}

export function SelectedEmailSummary({
  businessesSelected,
  emailsExtracted,
  emailsSelectedForCampaign,
  loading = false,
}: SelectedEmailSummaryProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Campaign Target Summary</h2>
      <p className="mt-1 text-sm text-slate-600">
        Review counts before proceeding to campaign setup.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Businesses Selected
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">
            {loading ? '—' : businessesSelected}
          </dd>
        </div>
        <div className="rounded-xl bg-indigo-50 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-indigo-700">
            Emails Extracted
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-indigo-900">
            {loading ? '—' : emailsExtracted}
          </dd>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-emerald-800">
            Emails Selected For Campaign
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-emerald-900">
            {loading ? '—' : emailsSelectedForCampaign}
          </dd>
        </div>
      </dl>
    </section>
  )
}
