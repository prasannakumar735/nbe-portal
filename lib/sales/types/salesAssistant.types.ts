import type { SalesAssistantCapability } from '@/lib/sales/constants/assistantCapabilities'

export type SalesAssistantRecommendedProduct = {
  slug: string
  label: string
  rationale: string
}

export type SalesAssistantSection = {
  heading: string
  body: string
}

export type SalesAssistantFollowUpDraft = {
  suggestedTiming: string
  talkingPoints: string[]
  note: string
}

export type SalesAssistantStructuredResult = {
  title: string
  summary: string
  sections: SalesAssistantSection[]
  bulletActions: string[]
  recommendedProducts?: SalesAssistantRecommendedProduct[]
  followUpDraft?: SalesAssistantFollowUpDraft
  inspectionNotes?: string
  quoteSummary?: string
}

export type SalesAssistantContextSnapshot = {
  business: {
    id: string
    companyName: string
    suburb: string | null
    postcode: string
    category: string | null
    website: string | null
  } | null
  contact: {
    id: string
    email: string | null
    verificationStatus: string
  } | null
  campaign: { id: string; name: string; status: string } | null
  pipeline: {
    id: string
    stage: string
    title: string
    revenueCents: number
    probabilityPercent: number
    notes: string
  } | null
  engagement: {
    replyDetected: boolean
    opened: boolean
    followupCount: number
  } | null
  recentEmails: { subject: string; status: string; excerpt: string }[]
}

export type SalesAssistantRunResult = {
  capability: SalesAssistantCapability
  provider: string
  latencyMs: number
  disclaimer: string
  context: SalesAssistantContextSnapshot
  result: SalesAssistantStructuredResult
  rawModelText?: string
}

export type SalesAssistantRunInput = {
  capability: SalesAssistantCapability
  businessId: string
  contactId?: string | null
  campaignId?: string | null
  opportunityId?: string | null
  replyText?: string | null
  managerNotes?: string | null
  provider?: string | null
}
