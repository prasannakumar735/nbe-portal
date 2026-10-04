import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

type PvcFlexSavePayload = {
  quoteId?:         string
  quoteNumber:      string
  date:             string
  validUntil:       string
  customerName:     string
  customerAddress:  string
  subtotal:         number
  endUser?:         string
  formSnapshot:     Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()
    const payload = await request.json() as PvcFlexSavePayload

    if (!payload.quoteNumber) {
      return NextResponse.json({ error: 'quoteNumber is required.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const gst   = Math.round(payload.subtotal * 0.1 * 100) / 100
    const total = Math.round(payload.subtotal * 1.1 * 100) / 100

    if (payload.quoteId) {
      const { error } = await supabase
        .from('quotes')
        .update({
          quote_number:  payload.quoteNumber,
          customer_name: payload.customerName || payload.quoteNumber,
          site_address:  payload.customerAddress || '',
          service_date:  payload.date,
          valid_until:   payload.validUntil,
          subtotal:      payload.subtotal,
          gst,
          total,
          form_snapshot: payload.formSnapshot,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', payload.quoteId)

      if (error) throw error
      return NextResponse.json({ ok: true, quoteId: payload.quoteId })
    }

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
        quote_kind:         'pvc_flex',
        quote_type:         'pvc_flex',
        quote_sub_category: 'pvc_flex',
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
