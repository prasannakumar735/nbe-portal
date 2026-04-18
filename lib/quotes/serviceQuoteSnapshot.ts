import type { ServiceLineItem, ServiceQuoteFormValues } from '@/components/quotes/types'

const DEFAULT_COMPANY_EMAIL = 'accountsreceivable@nbeaustralia.com.au'

/** Legacy PDF header used Service@…; normalize so old snapshots show the current address. */
function normalizeCompanyEmail(email: string): string {
  const t = email.trim()
  if (/^service@nbeaustralia\.com\.au$/i.test(t)) return DEFAULT_COMPANY_EMAIL
  return t
}

type QuoteItemRow = {
  description: string
  width: string | null
  height: string | null
  qty: number
  unit_price: number
  total: number
}

type QuoteRow = {
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
}

function defaultLineItem(): ServiceLineItem {
  return { description: '', width: '', height: '', qty: 1, unitPrice: 0 }
}

function mapDbItemToLine(row: QuoteItemRow): ServiceLineItem {
  return {
    description: row.description ?? '',
    width: row.width ?? '',
    height: row.height ?? '',
    qty: Number(row.qty ?? 1),
    unitPrice: Number(row.unit_price ?? 0),
  }
}

/** Build form values from DB row + line items when snapshot is missing or partial. */
export function quoteRowsToFormValues(quote: QuoteRow, items: QuoteItemRow[]): ServiceQuoteFormValues {
  const lines = items.length ? items.map(mapDbItemToLine) : [defaultLineItem()]

  const base: ServiceQuoteFormValues = {
    quoteNumber: quote.quote_number,
    serviceDate: String(quote.service_date).slice(0, 10),
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

  const snap = quote.form_snapshot
  if (snap && typeof snap === 'object' && snap !== null) {
    const s = snap as Partial<ServiceQuoteFormValues>
    return {
      ...base,
      ...s,
      quoteNumber: s.quoteNumber ?? base.quoteNumber,
      serviceDate: s.serviceDate ?? base.serviceDate,
      companyEmail: normalizeCompanyEmail(String(s.companyEmail ?? base.companyEmail)),
      items: Array.isArray(s.items) && s.items.length ? s.items.map(normalizeLine) : base.items,
    }
  }

  return base
}

function normalizeLine(line: Partial<ServiceLineItem>): ServiceLineItem {
  return {
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
  return {
    quoteNumber: String(s.quoteNumber ?? ''),
    serviceDate: String(s.serviceDate ?? '').slice(0, 10),
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
