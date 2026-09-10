import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function GET(request: NextRequest) {
  try {
    await requirePortalStaff()
    const supabase = createServiceRoleClient()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

    const { data, error } = await supabase
      .from('quotes')
      .select(`
        id,
        quote_number,
        customer_name,
        site_address,
        service_date,
        valid_until,
        subtotal,
        gst,
        total,
        workflow_status,
        rapid_door_quote_details (
          customer_attn,
          customer_postcode,
          customer_phone,
          customer_email,
          doors,
          include_summary,
          individual_install,
          end_user_type,
          image_style,
          page1_disclaimer,
          page2_note
        )
      `)
      .eq('quote_kind', 'rapid_door')
      .order('service_date', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ ok: true, data: data ?? [] })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to load quotes.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
