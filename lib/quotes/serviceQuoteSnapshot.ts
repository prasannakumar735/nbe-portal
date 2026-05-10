import type { RapidDoorQuoteFormValues, ServiceLineItem, ServiceQuoteFormValues } from '@/components/quotes/types'
import {
  defaultRapidDoorLineItems,
  emptyRapidDoorFormValues,
} from '@/lib/quotes/rapidDoorDefaults'
import {
  defaultSubCategoryForType,
  isQuoteTypeSlug,
  subCategoryAllowed,
  type QuoteTypeSlug,
} from '@/lib/quotes/quoteTaxonomy'

const DEFAULT_COMPANY_EMAIL = 'accountsreceivable@nbeaustralia.com.au'

/** Legacy PDF header used Service@…; normalize so old snapshots show the current address. */
function normalizeCompanyEmail(email: string): string {
  const t = email.trim()
  if (/^service@nbeaustralia\.com\.au$/i.test(t)) return DEFAULT_COMPANY_EMAIL
  return t
}

export type QuoteItemRow = {
  description: string
  item_title?: string | null
  width: string | null
  height: string | null
  qty: number
  unit_price: number
  total: number
}

export type QuoteRow = {
  id: string
  quote_number: string
  customer_name: string
  site_address: string
  service_date: string
  subtotal: number
  gst: number
  total: number
  created_at?: string
  form_snapshot?: unknown
  quote_kind?: string | null
  valid_until?: string | null
  quote_type?: string | null
  quote_sub_category?: string | null
}

function taxonomyForQuoteRow(quote: QuoteRow): { quoteType: QuoteTypeSlug; quoteSubCategory: string } {
  const typeRaw = String(quote.quote_type ?? '').trim().toLowerCase()
  const subRaw = String(quote.quote_sub_category ?? '').trim().toLowerCase()
  const quoteType = isQuoteTypeSlug(typeRaw) ? typeRaw : 'service'
  const quoteSubCategory = subCategoryAllowed(quoteType, subRaw) ? subRaw : defaultSubCategoryForType(quoteType)
  return { quoteType, quoteSubCategory }
}

function coerceTaxonomy(
  partial: { quoteType?: unknown; quoteSubCategory?: unknown },
  fallback: { quoteType: QuoteTypeSlug; quoteSubCategory: string },
): { quoteType: QuoteTypeSlug; quoteSubCategory: string } {
  const typeRaw = String(partial.quoteType ?? '').trim().toLowerCase()
  const quoteType = isQuoteTypeSlug(typeRaw) ? typeRaw : fallback.quoteType
  const subRaw = String(partial.quoteSubCategory ?? '').trim().toLowerCase()
  const quoteSubCategory = subCategoryAllowed(quoteType, subRaw) ? subRaw : defaultSubCategoryForType(quoteType)
  return { quoteType, quoteSubCategory }
}

function defaultLineItem(): ServiceLineItem {
  return { description: '', width: '', height: '', qty: 1, unitPrice: 0 }
}

function mapDbItemToLine(row: QuoteItemRow): ServiceLineItem {
  return {
    itemTitle: row.item_title?.trim() ? String(row.item_title) : undefined,
    description: row.description ?? '',
    width: row.width ?? '',
    height: row.height ?? '',
    qty: Number(row.qty ?? 1),
    unitPrice: Number(row.unit_price ?? 0),
  }
}

function serviceBaseFromQuote(quote: QuoteRow, items: QuoteItemRow[]): ServiceQuoteFormValues {
  const lines = items.length ? items.map(mapDbItemToLine) : [defaultLineItem()]
  const tax = taxonomyForQuoteRow(quote)

  return {
    quoteNumber: quote.quote_number,
    serviceDate: String(quote.service_date).slice(0, 10),
    quoteType: tax.quoteType,
    quoteSubCategory: tax.quoteSubCategory,
    companyName: 'NBE Australia Pty Ltd',
    abn: '17 007 048 008',
    companyAddress: '22a Humeside Drive, Campbellfield Victoria 3061 Australia',
    companyEmail: DEFAULT_COMPANY_EMAIL,
    customerCompany: quote.customer_name ?? '',
    contactPerson: '',
    phone: '',
    customerEmail: '',
    siteAddress: quote.site_address ?? '',
    items: lines,
    notes:
      'Should you require any further information or clarification about this quotation, please do not hesitate to contact us.',
    printedName: '',
    signatureDate: new Date().toISOString().split('T')[0],
  }
}

function rapidDoorBaseFromQuote(quote: QuoteRow, items: QuoteItemRow[]): RapidDoorQuoteFormValues {
  const template = emptyRapidDoorFormValues()
  const lines = items.length ? items.map(mapDbItemToLine) : defaultRapidDoorLineItems()

  const vu = quote.valid_until
    ? String(quote.valid_until).slice(0, 10)
    : template.validUntil

  return {
    ...template,
    quoteNumber: quote.quote_number,
    serviceDate: String(quote.service_date).slice(0, 10),
    validUntil: vu,
    customerCompany: quote.customer_name ?? '',
    siteAddress: quote.site_address ?? '',
    items: lines,
  }
}

/** Build form values from DB row + line items when snapshot is missing or partial. */
export function quoteRowsToFormValues(
  quote: QuoteRow,
  items: QuoteItemRow[],
): ServiceQuoteFormValues | RapidDoorQuoteFormValues {
  const kind = quote.quote_kind ?? 'service'

  const base =
    kind === 'rapid_door' ? rapidDoorBaseFromQuote(quote, items) : serviceBaseFromQuote(quote, items)

  const snap = quote.form_snapshot
  if (!snap || typeof snap !== 'object' || snap === null) {
    return base
  }

  const s = snap as Partial<ServiceQuoteFormValues> & Partial<RapidDoorQuoteFormValues>

  const mergedItems =
    Array.isArray(s.items) && s.items.length
      ? s.items.map(normalizeLine)
      : base.items

  const common = {
    ...base,
    ...s,
    quoteNumber: s.quoteNumber ?? base.quoteNumber,
    serviceDate: (s.serviceDate ?? base.serviceDate).slice(0, 10),
    companyEmail: normalizeCompanyEmail(String(s.companyEmail ?? base.companyEmail)),
    items: mergedItems,
  }

  const taxonomyMerged =
    kind === 'rapid_door'
      ? ({ quoteType: 'new_installation' as const, quoteSubCategory: 'rapid_door' } as const)
      : coerceTaxonomy(
          { quoteType: common.quoteType, quoteSubCategory: common.quoteSubCategory },
          taxonomyForQuoteRow(quote),
        )

  if (kind === 'rapid_door') {
    const r = base as RapidDoorQuoteFormValues
    return {
      ...common,
      ...taxonomyMerged,
      attn: String(s.attn ?? r.attn ?? ''),
      validUntil: String(s.validUntil ?? (common as RapidDoorQuoteFormValues).validUntil ?? '').slice(0, 10),
      salesContactName: String(s.salesContactName ?? r.salesContactName ?? ''),
      salesContactPhone: String(s.salesContactPhone ?? r.salesContactPhone ?? ''),
      salesContactEmail: String(s.salesContactEmail ?? r.salesContactEmail ?? ''),
      scheduleANotes: String(s.scheduleANotes ?? r.scheduleANotes ?? ''),
      quoteSubtitle: String(s.quoteSubtitle ?? r.quoteSubtitle ?? ''),
      introNote: String(s.introNote ?? r.introNote ?? ''),
    } as RapidDoorQuoteFormValues
  }

  return { ...common, ...taxonomyMerged } as ServiceQuoteFormValues
}

function normalizeLine(line: Partial<ServiceLineItem>): ServiceLineItem {
  const title = line.itemTitle?.trim()
  return {
    itemTitle: title ? String(line.itemTitle) : undefined,
    description: String(line.description ?? ''),
    width: String(line.width ?? ''),
    height: String(line.height ?? ''),
    qty: Number.isFinite(Number(line.qty)) ? Number(line.qty) : 1,
    unitPrice: Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice) : 0,
  }
}

export function computeServiceQuoteTotals(values: ServiceQuoteFormValues): {
  subtotal: number
  gst: number
  grandTotal: number
} {
  const subtotal = values.items.reduce((sum, row) => {
    const q = Number(row?.qty ?? 0)
    const u = Number(row?.unitPrice ?? 0)
    const qty = Number.isFinite(q) ? q : 0
    const unit = Number.isFinite(u) ? u : 0
    return sum + qty * unit
  }, 0)
  const gst = subtotal * 0.1
  return { subtotal, gst, grandTotal: subtotal + gst }
}

export function parseFormSnapshot(raw: unknown): ServiceQuoteFormValues | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<ServiceQuoteFormValues>
  if (!Array.isArray(s.items)) return null
  const quoteType = isQuoteTypeSlug(String(s.quoteType ?? '').trim().toLowerCase())
    ? (String(s.quoteType).trim().toLowerCase() as QuoteTypeSlug)
    : 'service'
  const subRaw = String(s.quoteSubCategory ?? '').trim().toLowerCase()
  const quoteSubCategory = subCategoryAllowed(quoteType, subRaw) ? subRaw : defaultSubCategoryForType(quoteType)

  return {
    quoteNumber: String(s.quoteNumber ?? ''),
    serviceDate: String(s.serviceDate ?? '').slice(0, 10),
    quoteType,
    quoteSubCategory,
    companyName: String(s.companyName ?? ''),
    abn: String(s.abn ?? ''),
    companyAddress: String(s.companyAddress ?? ''),
    companyEmail: normalizeCompanyEmail(String(s.companyEmail ?? '')),
    customerCompany: String(s.customerCompany ?? ''),
    contactPerson: String(s.contactPerson ?? ''),
    phone: String(s.phone ?? ''),
    customerEmail: String(s.customerEmail ?? ''),
    siteAddress: String(s.siteAddress ?? ''),
    items: s.items.map(normalizeLine),
    notes: String(s.notes ?? ''),
    printedName: String(s.printedName ?? ''),
    signatureDate: String(s.signatureDate ?? '').slice(0, 10),
  }
}

/** True when line has printable schedule content (Industrial Rapid Door allows ITEM-only rows). */
export function lineItemHasContent(item: Partial<ServiceLineItem>): boolean {
  return Boolean(String(item.itemTitle ?? '').trim() || String(item.description ?? '').trim())
}
