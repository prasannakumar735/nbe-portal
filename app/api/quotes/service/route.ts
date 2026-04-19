import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

type ServiceQuoteItemPayload = {
  description: string
  width: string
  height: string
  qty: number
  unitPrice: number
  total: number
}

type ServiceQuotePayload = {
  quote_number: string
  customer_name: string
  site_address: string
  service_date: string
  subtotal: number
  gst: number
  total: number
  items: ServiceQuoteItemPayload[]
  form_snapshot?: unknown
}

function toNumber(value: unknown): number {
  return Number(value)
}

function normalizeItems(items: ServiceQuotePayload['items']): ServiceQuoteItemPayload[] {
  if (!Array.isArray(items)) return []
  return items
    .map(item => ({
      ...item,
      description: String(item.description ?? '').trim(),
    }))
    .filter(item => item.description.length > 0)
}

function validatePayload(payload: ServiceQuotePayload, items: ServiceQuoteItemPayload[]) {
  if (!payload.quote_number?.trim()) {
    throw new Error('quote_number is required.')
  }
  if (!payload.customer_name?.trim()) {
    throw new Error('customer_name is required.')
  }
  if (!payload.site_address?.trim()) {
    throw new Error('site_address is required.')
  }
  if (!payload.service_date?.trim()) {
    throw new Error('service_date is required.')
  }

  const totalsToValidate = [payload.subtotal, payload.gst, payload.total]
  totalsToValidate.forEach(value => {
    if (!Number.isFinite(toNumber(value))) {
      throw new Error('subtotal, gst, and total must be valid numbers.')
    }
  })

  if (items.length === 0) {
    throw new Error('At least one line item with a description is required (empty rows are ignored).')
  }

  items.forEach((item, index) => {
    const numericFields = [item.qty, item.unitPrice, item.total]
    numericFields.forEach(value => {
      if (!Number.isFinite(toNumber(value))) {
        throw new Error(`items[${index}] has invalid numeric fields.`)
      }
    })
  })
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: string; details?: string; hint?: string }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  return 'Failed to save service quote.'
}

/** List saved quotes; optional `q` filters customer_name and quote_number (ilike). */
export async function GET(request: NextRequest) {
  try {
    await requirePortalStaff()

    const supabase = createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') ?? '').trim()

    let query = supabase
      .from('quotes')
      .select('id, quote_number, customer_name, site_address, service_date, total, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (q.length > 0) {
      const safe = q.replace(/%/g, '').replace(/,/g, '').slice(0, 120)
      query = query.or(`customer_name.ilike.%${safe}%,quote_number.ilike.%${safe}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ quotes: data ?? [] })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()

    const payload = (await request.json()) as ServiceQuotePayload
    const items = normalizeItems(payload.items)
    validatePayload(payload, items)

    /** Service role bypasses RLS; the user-scoped anon client often has no INSERT policy on `quotes`. */
    const supabase = createServiceRoleClient()

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: payload.quote_number.trim(),
        customer_name: payload.customer_name.trim(),
        site_address: payload.site_address.trim(),
        service_date: payload.service_date.trim(),
        subtotal: payload.subtotal,
        gst: payload.gst,
        total: payload.total,
        form_snapshot: payload.form_snapshot ?? null,
      })
      .select('id')
      .single()

    if (quoteError) {
      throw quoteError
    }

    const quoteItems = items.map(item => ({
      quote_id: quote.id,
      description: item.description,
      width: item.width || null,
      height: item.height || null,
      qty: item.qty,
      unit_price: item.unitPrice,
      total: item.total,
    }))

    const { error: itemsError } = await supabase.from('quote_items').insert(quoteItems)

    if (itemsError) {
      throw itemsError
    }

    return NextResponse.json({ success: true, quote_id: quote.id })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = errorMessage(error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
