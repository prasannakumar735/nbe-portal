'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { CampaignEmailStatsCard } from '@/components/sales-engine/CampaignEmailStatsCard'
import { EmailTemplateSummary } from '@/components/sales-engine/EmailTemplateSummary'
import { EmailVersionHistoryDrawer } from '@/components/sales-engine/EmailVersionHistoryDrawer'
import { GeneratedEmailEditorModal } from '@/components/sales-engine/GeneratedEmailEditorModal'
import { GeneratedEmailReviewTable } from '@/components/sales-engine/GeneratedEmailReviewTable'
import { GenerateEmailsPanel } from '@/components/sales-engine/GenerateEmailsPanel'
import { PromptPreviewPanel } from '@/components/sales-engine/PromptPreviewPanel'
import { QueueApprovedEmailsPanel } from '@/components/sales-engine/QueueApprovedEmailsPanel'
import { EmailSendQueueMonitorPanel } from '@/components/sales-engine/EmailSendQueueMonitorPanel'
import { CampaignEngagementPanel } from '@/components/sales-engine/CampaignEngagementPanel'
import { CampaignFollowupPanel } from '@/components/sales-engine/CampaignFollowupPanel'
import { SalesEnginePilotModeBanner } from '@/components/sales-engine/admin/SalesEnginePilotModeBanner'
import type { CampaignGeneratedEmailRow } from '@/lib/sales/review/campaignGeneratedEmailListService'
import { useCampaignEmailReview } from '@/hooks/useCampaignEmailReview'
import { useGeneratedEmailActions } from '@/hooks/useGeneratedEmailActions'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

type CampaignEmailReviewPageProps = {
  campaignId: string
}

export function CampaignEmailReviewPage({ campaignId }: CampaignEmailReviewPageProps) {
  const review = useCampaignEmailReview(campaignId)
  const actions = useGeneratedEmailActions(campaignId, review.refresh)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [editorRow, setEditorRow] = useState<CampaignGeneratedEmailRow | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<SalesGeneratedEmail[]>([])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const openHistory = useCallback(
    async (contactId: string) => {
      setHistoryOpen(true)
      setHistoryLoading(true)
      try {
        const res = await actions.loadHistory(contactId)
        setHistory(res.history)
      } catch {
        setHistory([])
      } finally {
        setHistoryLoading(false)
      }
    },
    [actions],
  )

  const handleSaveEdit = useCallback(
    async (subject: string, body: string) => {
      if (!editorRow) return
      await actions.editEmail(editorRow.id, subject, body)
      setEditorRow(null)
    },
    [actions, editorRow],
  )

  if (review.loading && !review.campaign) {
    return <p className="text-sm text-slate-600">Loading campaign…</p>
  }

  if (review.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {review.error}
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header>
        <Link
          href="/dashboard/sales-engine/campaign-builder"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          ← Campaign builder
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            {review.campaign?.name ?? 'Campaign emails'}
          </h1>
          {review.campaign?.status ? (
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              review.campaign.status === 'completed'
                ? 'bg-emerald-100 text-emerald-800'
                : review.campaign.status === 'sending'
                ? 'bg-indigo-100 text-indigo-800'
                : review.campaign.status === 'ready'
                ? 'bg-blue-100 text-blue-800'
                : review.campaign.status === 'paused'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {review.campaign.status}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-600">Generate, review, approve, then queue for send.</p>
      </header>

      <SalesEnginePilotModeBanner />

      <CampaignEmailStatsCard stats={review.stats} loading={review.loading} />
      <EmailTemplateSummary template={review.activeTemplate} loading={review.loading} />
      <PromptPreviewPanel campaignId={campaignId} />
      <GenerateEmailsPanel
        hasTemplate={Boolean(review.activeTemplate)}
        generating={review.generating}
        onGenerate={() => void review.generateAll()}
      />
      <GeneratedEmailReviewTable
        rows={review.rows}
        loading={review.loading}
        busyId={actions.busyId}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onEdit={setEditorRow}
        onApprove={(id) => void actions.approveEmail(id)}
        onReject={(id) => void actions.rejectEmail(id)}
        onRegenerate={(contactId) => void actions.regenerate(contactId)}
        onHistory={(contactId) => void openHistory(contactId)}
      />
      <QueueApprovedEmailsPanel
        rows={review.rows}
        selectedIds={selectedIds}
        busy={actions.busyId != null}
        onBulkApprove={(ids) => void actions.bulkApprove(ids)}
        onBulkQueue={(ids) => void actions.bulkQueue(ids)}
      />
      <EmailSendQueueMonitorPanel campaignId={campaignId} onMutated={review.refresh} />
      <CampaignEngagementPanel
        campaignId={campaignId}
        funnel={review.stats?.engagement ?? null}
        onSynced={review.refresh}
      />
      <CampaignFollowupPanel campaignId={campaignId} onMutated={review.refresh} />

      <GeneratedEmailEditorModal
        open={editorRow != null}
        email={editorRow}
        saving={actions.busyId === editorRow?.id}
        onClose={() => setEditorRow(null)}
        onSave={(subject, body) => void handleSaveEdit(subject, body)}
      />
      <EmailVersionHistoryDrawer
        open={historyOpen}
        loading={historyLoading}
        history={history}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  )
}
