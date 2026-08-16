import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeRate,
  computeRoiPercent,
  computeRoiRatio,
  estimateGooglePlacesCostUsd,
  googlePlacesUsdPerScanRun,
} from '@/lib/sales/analytics/salesAnalyticsCostEstimates'
import {
  buildTopIndustriesFromBusinessRows,
  buildTopSuburbsFromBusinessRows,
  countCompletedSalesScanRuns,
  countSalesBusinessesDiscovered,
  countSalesContactsDiscovered,
  countSalesGeneratedEmails,
  countSalesGeneratedEmailsApproved,
  countSalesGeneratedEmailsSent,
  countSalesEngagementRepliesByCampaign,
  countSalesGeneratedEmailsSentByCampaign,
  listSalesBusinessCategorySuburbSamples,
  listSalesCampaignNames,
  sumSalesContactEngagementFlags,
  sumSalesGenerationLogAiCostUsd,
  sumSalesGenerationLogAiCostUsdByCampaign,
  sumWonPipelineRevenueAudByCampaign,
} from '@/lib/sales/analytics/salesAnalyticsRepository'
import { computePromptPerformanceSnapshots } from '@/lib/sales/engagement/campaignEngagementAnalytics'
import type { SalesAnalyticsDashboard } from '@/lib/sales/types/salesAnalytics.types'

const TOP_N = 8

export async function buildSalesAnalyticsDashboard(
  supabase: SupabaseClient,
): Promise<SalesAnalyticsDashboard> {
  const [
    businessesDiscovered,
    contactsDiscovered,
    emailsGenerated,
    emailsApproved,
    emailsSent,
    engagementTotals,
    aiCostUsd,
    completedScans,
    businessSamples,
    campaigns,
    aiCostByCampaign,
    sentByCampaign,
    repliesByCampaign,
    wonRevenue,
    promptSnapshots,
  ] = await Promise.all([
    countSalesBusinessesDiscovered(supabase),
    countSalesContactsDiscovered(supabase),
    countSalesGeneratedEmails(supabase),
    countSalesGeneratedEmailsApproved(supabase),
    countSalesGeneratedEmailsSent(supabase),
    sumSalesContactEngagementFlags(supabase),
    sumSalesGenerationLogAiCostUsd(supabase),
    countCompletedSalesScanRuns(supabase),
    listSalesBusinessCategorySuburbSamples(supabase),
    listSalesCampaignNames(supabase),
    sumSalesGenerationLogAiCostUsdByCampaign(supabase),
    countSalesGeneratedEmailsSentByCampaign(supabase),
    countSalesEngagementRepliesByCampaign(supabase),
    sumWonPipelineRevenueAudByCampaign(supabase),
    computePromptPerformanceSnapshots(supabase),
  ])

  const googleApiCostUsd = estimateGooglePlacesCostUsd(completedScans)
  const totalSpendUsd = Math.round((aiCostUsd + googleApiCostUsd) * 1_000_000) / 1_000_000

  const topCampaigns = campaigns
    .map((c) => {
      const sent = sentByCampaign.get(c.id) ?? 0
      const replies = repliesByCampaign.get(c.id) ?? 0
      const ai = aiCostByCampaign.get(c.id) ?? 0
      const wonRevenueAud = wonRevenue.byCampaign.get(c.id) ?? 0
      const spend = ai + googleApiCostUsd / Math.max(campaigns.length, 1)
      return {
        campaignId: c.id,
        name: c.name,
        emailsSent: sent,
        replies,
        aiCostUsd: Math.round(ai * 1_000_000) / 1_000_000,
        wonRevenueAud,
        roiRatio: computeRoiRatio(wonRevenueAud, spend),
      }
    })
    .sort((a, b) => b.emailsSent - a.emailsSent || b.replies - a.replies)
    .slice(0, TOP_N)

  const topPrompts = [...promptSnapshots]
    .sort((a, b) => (b.reply_rate ?? 0) - (a.reply_rate ?? 0) || b.sample_size - a.sample_size)
    .slice(0, TOP_N)
    .map((p) => ({
      promptName: p.prompt_name,
      promptVersion: p.prompt_version,
      delivered: p.delivered,
      opened: p.opened,
      replied: p.replied,
      openRate: p.open_rate,
      replyRate: p.reply_rate,
    }))

  return {
    funnel: {
      businessesDiscovered,
      contactsDiscovered,
      emailsGenerated,
      emailsApproved,
      emailsSent,
      openRate: computeRate(engagementTotals.contactsOpened, engagementTotals.contactsDelivered),
      replyRate: computeRate(engagementTotals.contactsReplied, engagementTotals.contactsDelivered),
    },
    costs: {
      aiCostUsd,
      googleApiCostUsd,
      googleApiCostNote: `Estimated ${completedScans} completed scan run(s) × $${googlePlacesUsdPerScanRun()} USD (Places Text Search). Override with SALES_ANALYTICS_GOOGLE_PLACES_USD_PER_SCAN.`,
      totalSpendUsd,
    },
    roi: {
      wonRevenueAud: wonRevenue.totalAud,
      roiRatio: computeRoiRatio(wonRevenue.totalAud, totalSpendUsd),
      roiPercent: computeRoiPercent(wonRevenue.totalAud, totalSpendUsd),
    },
    topIndustries: buildTopIndustriesFromBusinessRows(businessSamples, TOP_N),
    topSuburbs: buildTopSuburbsFromBusinessRows(businessSamples, TOP_N),
    topCampaigns,
    topPrompts,
    generatedAt: new Date().toISOString(),
  }
}
