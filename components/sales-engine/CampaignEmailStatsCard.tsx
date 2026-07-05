'use client'

import type { CampaignEmailStats } from '@/lib/sales/review/campaignEmailStatsService'

type CampaignEmailStatsCardProps = {
  stats: CampaignEmailStats | null
  loading: boolean
}

export function CampaignEmailStatsCard({ stats, loading }: CampaignEmailStatsCardProps) {
  if (loading && !stats) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading statistics…</p>
      </section>
    )
  }

  if (!stats) return null

  const job = stats.generationJob
  const progress =
    job && job.totalContacts > 0
      ? Math.round((job.processedCount / job.totalContacts) * 100)
      : null

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Campaign statistics</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Audience</dt>
          <dd className="text-lg font-semibold text-slate-900">{stats.audienceContacts}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Draft</dt>
          <dd className="text-lg font-semibold text-slate-900">{stats.latestByStatus.draft}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Approved</dt>
          <dd className="text-lg font-semibold text-emerald-700">{stats.latestByStatus.approved}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Queued to send</dt>
          <dd className="text-lg font-semibold text-indigo-700">{stats.sendQueue.queued}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Edited</dt>
          <dd className="text-lg font-semibold text-slate-900">{stats.latestByStatus.edited}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Rejected</dt>
          <dd className="text-lg font-semibold text-red-700">{stats.latestByStatus.rejected}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Est. prompt tokens</dt>
          <dd className="text-lg font-semibold text-slate-900">{stats.tokenTotals.promptTokens}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Sent</dt>
          <dd className="text-lg font-semibold text-emerald-700">{stats.sendQueue.sent}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Send failed</dt>
          <dd className="text-lg font-semibold text-red-700">{stats.sendQueue.failed}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Not generated</dt>
          <dd className="text-lg font-semibold text-slate-900">{stats.withoutDraft}</dd>
        </div>
      </dl>
      {job ? (
        <p className="mt-3 text-sm text-slate-600">
          Generation job: {job.status}
          {progress != null ? ` · ${progress}% (${job.processedCount}/${job.totalContacts})` : ''}
          {job.failedCount > 0 ? ` · ${job.failedCount} failed` : ''}
        </p>
      ) : null}
    </section>
  )
}
