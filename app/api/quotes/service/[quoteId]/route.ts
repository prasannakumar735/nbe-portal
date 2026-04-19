import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { quoteRowsToFormValues } from '@/lib/quotes/serviceQuoteSnapshot'

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
  return 'Failed to process service quote.'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    await requirePortalStaff()

    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: quote, error: qErr } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()

    if (qErr) throw qErr
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
    }

    const { data: items, error: iErr } = await supabase
      .from('quote_items')
      .select('description, width, height, qty, unit_price, total')
      .eq('quote_id', quoteId)
      .order('id', { ascending: true })

    if (iErr) throw iErr

    const formValues = quoteRowsToFormValues(quote, items ?? [])

    return NextResponse.json({
      quote: {
        id: quote.id,
        quote_number: quote.quote_number,
        customer_name: quote.customer_name,
        site_address: quote.site_address,
        service_date: quote.service_date,
        subtotal: quote.subtotal,
        gst: quote.gst,
        total: quote.total,
        created_at: quote.created_at,
        form_snapshot: quote.form_snapshot,
      },
      items: items ?? [],
      formValues,
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    await requirePortalStaff()

    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const payload = (await request.json()) as ServiceQuotePayload
    const items = normalizeItems(payload.items)
    validatePayload(payload, items)

    const supabase = createServiceRoleClient()

    const { error: upErr } = await supabase
      .from('quotes')
      .update({
        quote_number: payload.quote_number.trim(),
        customer_name: payload.customer_name.trim(),
        site_address: payload.site_address.trim(),
        service_date: payload.service_date.trim(),
        subtotal: payload.subtotal,
        gst: payload.gst,
        total: payload.total,
        form_snapshot: payload.form_snapshot ?? null,
      })
      .eq('id', quoteId)

    if (upErr) throw upErr

    const { error: delErr } = await supabase.from('quote_items').delete().eq('quote_id', quoteId)
    if (delErr) throw delErr

    const quoteItems = items.map(item => ({
      quote_id: quoteId,
      description: item.description,
      width: item.width || null,
      height: item.height || null,
      qty: item.qty,
      unit_price: item.unitPrice,
      total: item.total,
    }))

    const { error: insErr } = await supabase.from('quote_items').insert(quoteItems)
    if (insErr) throw insErr

    return NextResponse.json({ success: true, quote_id: quoteId })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    await requirePortalStaff()

    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}
