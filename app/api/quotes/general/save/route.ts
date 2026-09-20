import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

type GeneralSavePayload = {
  quoteId?:         string   // present on update
  quoteNumber:      string
  date:             string
  validUntil:       string
  customerName:     string
  customerAttn:     string
  customerAddress:  string
  customerPostcode: string
  customerPhone:    string
  customerEmail:    string
  subtotal:         number
  discountPct:      number
  endUser?:         string
  formSnapshot:     Record<string, unknown>  // full form state for re-editing
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()
    const payload = await request.json() as GeneralSavePayload

    if (!payload.quoteNumber) {
      return NextResponse.json({ error: 'quoteNumber is required.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const afterDisc = payload.subtotal * (1 - (payload.discountPct ?? 0) / 100)
    const gst       = Math.round(afterDisc * 0.1 * 100) / 100
    const total     = Math.round(afterDisc * 1.1 * 100) / 100

    if (payload.quoteId) {
      // Update existing row
      const { error } = await supabase
        .from('quotes')
        .update({
          quote_number:    payload.quoteNumber,
          customer_name:   payload.customerName || payload.quoteNumber,
          site_address:    payload.customerAddress || null,
          service_date:    payload.date,
          valid_until:     payload.validUntil,
          subtotal:        payload.subtotal,
          gst,
          total,
          form_snapshot:   payload.formSnapshot,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', payload.quoteId)

      if (error) throw error
      return NextResponse.json({ ok: true, quoteId: payload.quoteId })
    }

    // Insert new row
    const { data: quote, error: insertErr } = await supabase
      .from('quotes')
      .insert({
        quote_number:       payload.quoteNumber,
        customer_name:      payload.customerName || payload.quoteNumber,
        site_address:       payload.customerAddress || null,
        service_date:       payload.date,
        valid_until:        payload.validUntil,
        subtotal:           payload.subtotal,
        gst,
        total,
        quote_kind:         'general',
        quote_type:         'general',
        quote_sub_category: 'general',
        workflow_status:    'draft_review',
        form_snapshot:      payload.formSnapshot,
      })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    return NextResponse.json({ ok: true, quoteId: quote.id })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message =
      error instanceof Error ? error.message :
      (error && typeof error === 'object' && 'message' in error) ? String((error as { message: unknown }).message) :
      'Failed to save quote.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
