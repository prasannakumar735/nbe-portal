export type SalesAnalyticsFunnel = {
  businessesDiscovered: number
  contactsDiscovered: number
  emailsGenerated: number
  emailsApproved: number
  emailsSent: number
  openRate: number | null
  replyRate: number | null
}

export type SalesAnalyticsCosts = {
  aiCostUsd: number
  googleApiCostUsd: number
  googleApiCostNote: string
  totalSpendUsd: number
}

export type SalesAnalyticsRoi = {
  wonRevenueAud: number
  roiRatio: number | null
  roiPercent: number | null
}

export type SalesAnalyticsRankedRow = {
  key: string
  label: string
  count: number
}

export type SalesAnalyticsCampaignRow = {
  campaignId: string
  name: string
  emailsSent: number
  replies: number
  aiCostUsd: number
  wonRevenueAud: number
  roiRatio: number | null
}

export type SalesAnalyticsPromptRow = {
  promptName: string
  promptVersion: number
  delivered: number
  opened: number
  replied: number
  openRate: number | null
  replyRate: number | null
}

export type SalesAnalyticsDashboard = {
  funnel: SalesAnalyticsFunnel
  costs: SalesAnalyticsCosts
  roi: SalesAnalyticsRoi
  topIndustries: SalesAnalyticsRankedRow[]
  topSuburbs: SalesAnalyticsRankedRow[]
  topCampaigns: SalesAnalyticsCampaignRow[]
  topPrompts: SalesAnalyticsPromptRow[]
  generatedAt: string
}
