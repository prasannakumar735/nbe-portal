'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CampaignAudienceSummary } from '@/components/sales-engine/CampaignAudienceSummary'
import { CampaignBuilderForm } from '@/components/sales-engine/CampaignBuilderForm'
import { CampaignContactsPreview } from '@/components/sales-engine/CampaignContactsPreview'
import { SaveCampaignButton } from '@/components/sales-engine/SaveCampaignButton'
import { useCampaignBuilder } from '@/hooks/useCampaignBuilder'

export function CampaignBuilderPage() {
  const router = useRouter()
  const builder = useCampaignBuilder()

  useEffect(() => {
    if (!builder.sessionReady) return
    if (!builder.hasAudience) {
      router.replace('/dashboard/sales-engine')
    }
  }, [builder.sessionReady, builder.hasAudience, router])

  if (!builder.sessionReady) {
    return (
      <div className="w-full min-w-0 max-w-6xl">
        <p className="text-sm text-slate-600">Loading campaign builder…</p>
      </div>
    )
  }

  if (!builder.hasAudience) {
    return null
  }

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/sales-engine"
            className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            ← Back to Sales Engine
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Campaign Builder</h1>
          <p className="mt-1 text-sm text-slate-600">
            Prepare outreach campaign before AI email generation
          </p>
        </div>
        {builder.savedStatus === 'draft' ? (
          <span className="inline-flex self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Status: draft
          </span>
        ) : null}
      </header>

      <CampaignBuilderForm
        values={builder.form}
        onChange={builder.updateForm}
        campaignTypes={builder.campaignTypes}
        offerTypes={builder.offerTypes}
        catalogLoading={builder.catalogLoading}
        disabled={builder.saving || builder.savedCampaignId != null}
        fieldErrors={builder.fieldErrors}
      />

      {builder.catalogError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {builder.catalogError}
        </div>
      ) : null}

      <CampaignAudienceSummary
        selectedBusinesses={builder.audienceCounts.businesses}
        selectedEmails={builder.audienceCounts.emails}
        loading={builder.previewLoading}
      />

      <CampaignContactsPreview
        rows={builder.previewRows}
        loading={builder.previewLoading}
        error={builder.previewError}
      />

      {builder.saveError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {builder.saveError}
        </div>
      ) : null}

      <SaveCampaignButton
        onSave={() => void builder.saveDraft()}
        saving={builder.saving}
        disabled={!builder.formComplete || builder.savedCampaignId != null}
      />

      {builder.savedCampaignId ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Next: AI email generation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Generate personalised drafts, review and edit them, approve, then queue for send.
          </p>
          <Link
            href={`/dashboard/sales-engine/campaigns/${builder.savedCampaignId}/emails`}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Review &amp; generate emails
          </Link>
        </section>
      ) : null}
    </div>
  )
}
