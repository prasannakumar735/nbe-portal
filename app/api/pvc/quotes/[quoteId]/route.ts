import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import {
  buildSnapshotV1,
  parsePVCCalculatorSnapshot,
  type PVCCalculatorSnapshotV1,
} from '@/lib/pvc/pvcCalculatorSnapshot'
import { pvcQuoteDraftRowFromSnapshot } from '@/lib/pvc/pvcQuotesDb'
import { exportWorkflowFields, profileDisplayName } from '@/lib/pvc/pvcQuoteWorkflowService'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: string; details?: string; hint?: string }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  return 'Failed to process PVC quote.'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SavePayload = {
  form_snapshot: unknown
}

function snapshotFromPayload(payload: SavePayload): PVCCalculatorSnapshotV1 {
  const raw = payload.form_snapshot
  if (raw === undefined || raw === null) {
    throw new Error('form_snapshot is required.')
  }
  return parsePVCCalculatorSnapshot(raw)
}

function rowFromSnapshot(snapshot: PVCCalculatorSnapshotV1) {
  return pvcQuoteDraftRowFromSnapshot(snapshot)
}

export async function GET(_request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    await requirePortalStaff()

    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: quote, error } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()

    if (error) throw error
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
    }

    let snapshot: PVCCalculatorSnapshotV1 | null = null
    if (quote.form_snapshot) {
      try {
        snapshot = parsePVCCalculatorSnapshot(quote.form_snapshot)
      } catch {
        snapshot = null
      }
    }

    let assigneeName: string | null = null
    if (quote.assigned_user_id) {
      assigneeName = await profileDisplayName(supabase, String(quote.assigned_user_id))
    }

    return NextResponse.json({
      quote: {
        id: quote.id,
        customer_name: quote.customer_name,
        ref_no: quote.ref_no,
        site_address: quote.site_address,
        total_price: quote.total_price,
        status: quote.status,
        quote_label: quote.quote_label,
        created_at: quote.created_at,
        updated_at: quote.updated_at,
        form_snapshot: quote.form_snapshot,
        ...exportWorkflowFields(quote as Record<string, unknown>, assigneeName),
      },
      snapshot,
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

    const payload = (await request.json()) as SavePayload
    const snapshot = snapshotFromPayload(payload)
    const built = buildSnapshotV1(snapshot)

    const supabase = createServiceRoleClient()
    const { error } = await supabase.from('pvc_quotes').update(rowFromSnapshot(built)).eq('id', quoteId)

    if (error) throw error

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
    const { error } = await supabase.from('pvc_quotes').delete().eq('id', quoteId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}
