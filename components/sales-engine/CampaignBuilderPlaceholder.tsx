'use client'

import { useRouter } from 'next/navigation'
import { saveCampaignBuilderSession } from '@/lib/sales/campaignBuilderSession'

type CampaignBuilderPlaceholderProps = {
  selectedEmailCount: number
  selectedEmailIds: string[]
  selectedBusinessIds: string[]
  disabled?: boolean
}

export function CampaignBuilderPlaceholder({
  selectedEmailCount,
  selectedEmailIds,
  selectedBusinessIds,
  disabled = false,
}: CampaignBuilderPlaceholderProps) {
  const router = useRouter()
  const isDisabled = disabled || selectedEmailCount < 1

  function handleProceed() {
    saveCampaignBuilderSession({
      selectedEmailIds,
      selectedBusinessIds,
    })
    router.push('/dashboard/sales-engine/campaign-builder')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Next Step</h2>
      <p className="mt-1 text-sm text-slate-600">
        Proceed when you have selected the email addresses for your campaign.
      </p>
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleProceed}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Proceed To Campaign Builder
      </button>
      {selectedEmailCount < 1 ? (
        <p className="mt-2 text-xs text-slate-500">Select at least one email in Contact Review.</p>
      ) : null}
    </section>
  )
}
