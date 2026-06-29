import type { SalesContactSource, SalesContactType } from '@/lib/sales/types/contactSources'

export type ContactResult = {
  email: string | null
  phone: string | null
  contact_page: string | null
  contact_type: SalesContactType
  confidence_score: number
  source: SalesContactSource
}

export interface ContactDiscoveryProvider {
  readonly providerId: string
  scanWebsite(url: string): Promise<ContactResult[]>
}
