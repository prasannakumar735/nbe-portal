import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'

export type ServiceLineItem = {
  /** Industrial Rapid Door schedule "ITEM" column (optional for service quotes). */
  itemTitle?: string
  /** Editable serial number label (e.g. "1", "2a", "3."). Defaults to row index+1 when omitted. */
  sno?: string
  description: string

  width: string
  height: string
  qty: number
  unitPrice: number
  /** Manual total override — supersedes qty × unitPrice when set. */
  totalOverride?: number
  /** Door/item-level notes shown below the row in the PDF. */
  itemNotes?: string
}

export type ServiceQuoteFormValues = {
  quoteNumber: string
  serviceDate: string
  /** Quote valid until / expiry date. */
  validUntil: string
  /** Salesperson name shown on the quote. */
  salesperson: string
  /** Payment terms text (e.g. "30 EOM", "COD"). */
  paymentTerms: string
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
  /** Discount percentage (0–100) applied to subtotal before GST. */
  discountPercent: number
  /** When true, hides Unit Price and per-line Total from the PDF / printed output. */
  hidePricing: boolean
  notes: string
  printedName: string
  signatureDate: string
}

export type QuoteKind = 'service' | 'rapid_door'

/** Industrial Rapid Door quotation (extends service quote fields + PDF-specific blocks). */
export type RapidDoorQuoteFormValues = ServiceQuoteFormValues & {
  attn: string
  salesContactName: string
  salesContactPhone: string
  salesContactEmail: string
  /** Page 2 — Schedule A body (free text). */
  scheduleANotes: string
  quoteSubtitle: string
  /** Scope / standard offering paragraph(s) above the customer block. */
  introNote: string
}
