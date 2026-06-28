import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import {
  buildSnapshotV1,
  parsePVCCalculatorSnapshot,
  type PVCCalculatorSnapshotV1,
} from '@/lib/pvc/pvcCalculatorSnapshot'
import {
  appendWorkflowHistory,
  type PvcWorkflowHistoryEntry,
} from '@/lib/pvc/pvcQuoteWorkflow'
import { pvcQuoteDraftRowFromSnapshot } from '@/lib/pvc/pvcQuotesDb'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: string; details?: string; hint?: string }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  return 'Failed to process PVC quote.'
}

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

function rowFromSnapshot(snapshot: PVCCalculatorSnapshotV1, createdBy: string | null) {
  return pvcQuoteDraftRowFromSnapshot(snapshot, { createdBy })
}

/** List saved PVC calculator quotes; optional `q` filters customer_name and ref_no. */
export async function GET(request: NextRequest) {
  try {
    await requirePortalStaff()

    const supabase = createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') ?? '').trim()

    let query = supabase
      .from('pvc_quotes')
      .select(
        'id, customer_name, ref_no, site_address, total_price, status, quote_label, workflow_status, invoice_status, assigned_user_id, created_at, updated_at',
      )
      .order('updated_at', { ascending: false })
      .limit(200)

    if (q.length > 0) {
      const safe = q.replace(/%/g, '').replace(/,/g, '').slice(0, 120)
      query = query.or(`customer_name.ilike.%${safe}%,ref_no.ilike.%${safe}%,quote_label.ilike.%${safe}%`)
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
    const { user } = await requirePortalStaff()
    const payload = (await request.json()) as SavePayload
    const snapshot = snapshotFromPayload(payload)
    const built = buildSnapshotV1(snapshot)

    const supabase = createServiceRoleClient()
    const createdBy = user?.id ?? null
    const row = {
      ...rowFromSnapshot(built, createdBy),
      workflow_history: appendWorkflowHistory([], {
        status: 'draft_review',
        at: new Date().toISOString(),
        by_user_id: user?.id ?? null,
        note: 'Quote saved',
      } satisfies PvcWorkflowHistoryEntry),
    }

    const { data, error } = await supabase.from('pvc_quotes').insert(row).select('id').single()

    if (error) throw error

    return NextResponse.json({ success: true, quote_id: data.id })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}
