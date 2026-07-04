import type { SalesContactVerificationStatus } from '@/lib/sales/constants/contactVerification'
import type {
  ContactDiscoveryMethod,
  ContactPageKind,
} from '@/lib/sales/types/contactDiscovery.types'
import type { SalesContactSource, SalesContactType } from '@/lib/sales/types/contactSources'

export type { SalesContactSource, SalesContactType } from '@/lib/sales/types/contactSources'
export { SALES_CONTACT_SOURCES, SALES_CONTACT_TYPES } from '@/lib/sales/types/contactSources'
export type { SalesContactVerificationStatus } from '@/lib/sales/constants/contactVerification'
export { SALES_CONTACT_VERIFICATION_STATUSES } from '@/lib/sales/constants/contactVerification'

export type SalesContact = {
  id: string
  business_id: string
  email: string | null
  phone: string | null
  contact_page: string | null
  contact_type: SalesContactType
  confidence_score: number
  is_primary: boolean
  source: SalesContactSource
  email_verified: boolean
  verification_status: SalesContactVerificationStatus
  created_at: string
  discovery_page_title: string | null
  discovery_method: ContactDiscoveryMethod | null
  page_kind: ContactPageKind | null
  recommended_for_outreach: boolean
  recommended_reason: string | null
  discovered_at: string
}

export type SalesContactInsert = {
  business_id: string
  email?: string | null
  phone?: string | null
  contact_page?: string | null
  contact_type?: SalesContactType
  confidence_score?: number
  is_primary?: boolean
  source: SalesContactSource
  email_verified?: boolean
  verification_status?: SalesContactVerificationStatus
  discovery_page_title?: string | null
  discovery_method?: ContactDiscoveryMethod | null
  page_kind?: ContactPageKind | null
  recommended_for_outreach?: boolean
  recommended_reason?: string | null
  discovered_at?: string
}

export type SalesContactVerificationPatch = {
  email_verified: boolean
  verification_status: SalesContactVerificationStatus
}

import type { SalesJob } from '@/lib/sales/jobs/job.types'

export type ContactDiscoveryAgentResult = {
  jobs: SalesJob[]
  results: ContactDiscoveryJobSummary[]
}

export type ContactDiscoveryJobSummary = {
  business_id: string
  contacts_discovered?: number
  contacts_inserted: number
  contacts_updated?: number
  contacts_recommended?: number
  contacts_skipped: number
  pages_scanned: number
  error?: string
}
