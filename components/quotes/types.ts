import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'

export type ServiceLineItem = {
  /** Industrial Rapid Door schedule “ITEM” column (optional for service quotes). */
  itemTitle?: string
  description: string
  width: string
  height: string
  qty: number
  unitPrice: number
}

export type ServiceQuoteFormValues = {
  quoteNumber: string
  serviceDate: string
  /** Manager taxonomy — persisted on `quotes.quote_type` / `quotes.quote_sub_category`. */
  quoteType: QuoteTypeSlug
  quoteSubCategory: string
  companyName: string
  abn: string
  companyAddress: string
  companyEmail: string
  customerCompany: string
  contactPerson: string
  phone: string
  customerEmail: string
  siteAddress: string
  items: ServiceLineItem[]
  notes: string
  printedName: string
  signatureDate: string
}

export type QuoteKind = 'service' | 'rapid_door'

/** Industrial Rapid Door quotation (extends service quote fields + PDF-specific blocks). */
export type RapidDoorQuoteFormValues = ServiceQuoteFormValues & {
  attn: string
  validUntil: string
  salesContactName: string
  salesContactPhone: string
  salesContactEmail: string
  /** Page 2 — Schedule A body (free text). */
  scheduleANotes: string
  quoteSubtitle: string
  /** Scope / standard offering paragraph(s) above the customer block. */
  introNote: string
}