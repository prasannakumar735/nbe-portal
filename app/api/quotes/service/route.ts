import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
}

function toNumber(value: unknown): number {
  return Number(value)
}

function validatePayload(payload: ServiceQuotePayload) {
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

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('At least one line item is required.')
  }

  payload.items.forEach((item, index) => {
    if (!item.description?.trim()) {
      throw new Error(`items[${index}].description is required.`)
    }

    const numericFields = [item.qty, item.unitPrice, item.total]
    numericFields.forEach(value => {
      if (!Number.isFinite(toNumber(value))) {
        throw new Error(`items[${index}] has invalid numeric fields.`)
      }
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ServiceQuotePayload
    validatePayload(payload)

    const supabase = await createServerClient()

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: payload.quote_number,
        customer_name: payload.customer_name,
        site_address: payload.site_address,
        service_date: payload.service_date,
        subtotal: payload.subtotal,
        gst: payload.gst,
        total: payload.total,
      })
      .select('id')
      .single()

    if (quoteError) {
      throw quoteError
    }

    const quoteItems = payload.items.map(item => ({
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
    const message = error instanceof Error ? error.message : 'Failed to save service quote.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
