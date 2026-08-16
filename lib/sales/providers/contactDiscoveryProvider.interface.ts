import type { SalesContactSource, SalesContactType } from '@/lib/sales/types/contactSources'
import type {
  ContactDiscoveryMethod,
  ContactPageKind,
} from '@/lib/sales/types/contactDiscovery.types'

export type ContactResult = {
  email: string | null
  phone: string | null
  contact_page: string | null
  contact_type: SalesContactType
  confidence_score: number
  source: SalesContactSource
  discovery_page_title: string | null
  discovery_method: ContactDiscoveryMethod | null
  page_kind: ContactPageKind
  link_label?: string | null
  recommended_for_outreach?: boolean
  recommended_reason?: string | null
}

export type ContactScanResult = {
  results: ContactResult[]
  pages_scanned: number
}

export interface ContactDiscoveryProvider {
  readonly providerId: string
  scanWebsite(url: string): Promise<ContactScanResult>
}
