import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesGeneratedEmailStatus } from '@/lib/sales/constants/generatedEmailStatuses'
import { listLatestSalesGeneratedEmailsByCampaign } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { listSalesEmailSendQueue } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { listSalesGenerationJobs } from '@/lib/sales/repositories/salesGenerationJobRepository'
import { listSalesGenerationLogs } from '@/lib/sales/repositories/salesGenerationLogRepository'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { getCampaignEngagementFunnel } from '@/lib/sales/engagement/campaignEngagementAnalytics'
import type { CampaignEngagementFunnel } from '@/lib/sales/types/engagementEvent.types'

export type CampaignEmailStatusCounts = Record<SalesGeneratedEmailStatus, number>

export type CampaignEmailStats = {
  campaignId: string
  audienceContacts: number
  latestByStatus: CampaignEmailStatusCounts
  withoutDraft: number
  generationJob: {
    id: string
    status: string
    processedCount: number
    totalContacts: number
    successCount: number
    failedCount: number
  } | null
  tokenTotals: {
    promptTokens: number
    completionTokens: number
  }
  sendQueue: {
    queued: number
    sent: number
    failed: number
  }
  engagement: CampaignEngagementFunnel
}

function emptyStatusCounts(): CampaignEmailStatusCounts {
  return {
    draft: 0,
    approved: 0,
    edited: 0,
    rejected: 0,
    queued: 0,
    sent: 0,
  }
}

export async function getCampaignEmailStats(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignEmailStats> {
  const campaign = await getSalesCampaignById(supabase, campaignId)
  if (!campaign) {
    throw new Error('Campaign not found.')
  }

  const latest = await listLatestSalesGeneratedEmailsByCampaign(supabase, campaignId)
  const latestByStatus = emptyStatusCounts()
  for (const row of latest) {
    latestByStatus[row.status] += 1
  }

  const jobs = await listSalesGenerationJobs(supabase, { campaignId, limit: 1 })
  const activeJob = jobs[0] ?? null

  const logs = await listSalesGenerationLogs(supabase, { campaignId, limit: 500 })
  let promptTokens = 0
  let completionTokens = 0
  for (const log of logs) {
    promptTokens += log.prompt_tokens
    completionTokens += log.completion_tokens
  }

  const queueRows = await listSalesEmailSendQueue(supabase, { campaignId, limit: 500 })
  const sendQueue = { queued: 0, sent: 0, failed: 0 }
  for (const row of queueRows) {
    if (row.status === 'queued' || row.status === 'sending') sendQueue.queued += 1
    else if (row.status === 'sent') sendQueue.sent += 1
    else if (row.status === 'failed' || row.status === 'bounced') sendQueue.failed += 1
  }

  const withoutDraft = Math.max(0, campaign.total_contacts - latest.length)

  const engagement = await getCampaignEngagementFunnel(supabase, campaignId)

  return {
    campaignId,
    audienceContacts: campaign.total_contacts,
    latestByStatus,
    withoutDraft,
    generationJob: activeJob
      ? {
          id: activeJob.id,
          status: activeJob.status,
          processedCount: activeJob.processed_count,
          totalContacts: activeJob.total_contacts,
          successCount: activeJob.success_count,
          failedCount: activeJob.failed_count,
        }
      : null,
    tokenTotals: { promptTokens, completionTokens },
    sendQueue,
    engagement,
  }
}
