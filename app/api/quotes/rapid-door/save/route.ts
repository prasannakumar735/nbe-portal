import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import type { DoorLineItem } from '@/lib/pdf/generateRapidDoorQuotePdf'

type SavePayload = {
  quoteNumber:       string
  quoteId?:          string   // present on update (regenerate)
  date:              string
  validUntil:        string
  customerName:      string
  customerAttn?:     string
  customerAddress:   string
  customerPostcode?: string
  customerPhone?:    string
  customerEmail?:    string
  grandTotal:        number
  doors:             DoorLineItem[]
  includeSummary:    boolean
  individualInstall: boolean
  endUser?:          string
  imageStyle?:       string
  page1Disclaimer?:  string
  page2SummaryNote?: string
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requirePortalStaff()
    const payload = await request.json() as SavePayload

    if (!payload.quoteNumber || !payload.customerAddress || !Array.isArray(payload.doors)) {
      return NextResponse.json({ error: 'quoteNumber, customerAddress, and doors are required.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const subtotal   = payload.grandTotal
    const gst        = Math.round(subtotal * 0.1 * 100) / 100
    const total      = Math.round(subtotal * 1.1 * 100) / 100

    let quoteId = payload.quoteId ?? null

    if (!quoteId) {
      // First save — insert into quotes (common source of truth)
      const { data: quote, error: insertErr } = await supabase
        .from('quotes')
        .insert({
          quote_number:       payload.quoteNumber,
          customer_name:      payload.customerName || payload.quoteNumber,
          site_address:       payload.customerAddress || '',
          service_date:       payload.date,
          valid_until:        payload.validUntil,
          subtotal,
          gst,
          total,
          quote_kind:         'rapid_door',
          quote_type:         'new_installation',
          quote_sub_category: 'rapid_door',
          workflow_status:    'draft_review',
          form_snapshot:      null,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr
      quoteId = quote.id
    } else {
      // Regenerate — update totals on the existing quotes row
      const { error: updateErr } = await supabase
        .from('quotes')
        .update({ subtotal, gst, total, customer_name: payload.customerName || payload.quoteNumber, updated_at: new Date().toISOString() })
        .eq('id', quoteId)

      if (updateErr) throw updateErr
    }

    // Upsert the rapid-door-specific detail row (linked to quotes.id)
    const { error: detailErr } = await supabase
      .from('rapid_door_quote_details')
      .upsert(
        {
          quote_id:          quoteId,
          customer_attn:     payload.customerAttn     || null,
          customer_postcode: payload.customerPostcode || null,
          customer_phone:    payload.customerPhone    || null,
          customer_email:    payload.customerEmail    || null,
          doors:             payload.doors,
          include_summary:   payload.includeSummary   ?? true,
          individual_install: payload.individualInstall ?? false,
          end_user_type:     payload.endUser          || null,
          image_style:       payload.imageStyle       || 'withOutText',
          page1_disclaimer:  payload.page1Disclaimer  || null,
          page2_note:        payload.page2SummaryNote || null,
        },
        { onConflict: 'quote_id' },
      )

    if (detailErr) throw detailErr

    return NextResponse.json({ ok: true, quoteId })
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
