import { NextRequest, NextResponse } from 'next/server'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import {
  approvePvcQuote,
  closePvcQuoteFromDraft,
  markPvcQuoteShippedOrInstalled,
  profileDisplayName,
  resumePvcQuoteFromHold,
  setPvcQuoteOnHold,
  setPvcQuoteInvoiceStatus,
} from '@/lib/pvc/pvcQuoteWorkflowService'
import type { PvcInvoiceStatus, PvcJobSupplyScope, PvcWorkflowClosedStatus } from '@/lib/pvc/pvcQuoteWorkflow'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Workflow update failed.'
}

type WorkflowBody = {
  action?: string
  approval_po_reference?: string
  approval_message?: string
  assigned_user_id?: string
  job_card_headrail_length_mm?: number | string | null
  job_card_supply_scope?: PvcJobSupplyScope
  invoice_status?: PvcInvoiceStatus
  closure_note?: string
}

export async function POST(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    const { supabase, user } = await requirePortalStaff()
    const manager = await isManagerOrAdmin(supabase, user.id)
    if (!manager) {
      return NextResponse.json({ error: 'Only managers can update quote workflow.' }, { status: 403 })
    }

    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const body = (await request.json()) as WorkflowBody
    const action = String(body.action ?? '').trim()
    const admin = createServiceRoleClient()
    const actorName = await profileDisplayName(admin, user.id)

    if (action === 'approve') {
      const scope = body.job_card_supply_scope as PvcJobSupplyScope
      const headrailRaw = body.job_card_headrail_length_mm
      const headrailParsed =
        headrailRaw === null || headrailRaw === undefined || headrailRaw === ''
          ? null
          : Number(headrailRaw)
      if (headrailParsed !== null && !Number.isFinite(headrailParsed)) {
        return NextResponse.json({ error: 'Invalid headrail length.' }, { status: 400 })
      }
      await approvePvcQuote(admin, quoteId, user.id, actorName, {
        approval_po_reference: String(body.approval_po_reference ?? ''),
        approval_message: String(body.approval_message ?? ''),
        assigned_user_id: String(body.assigned_user_id ?? '').trim(),
        job_card_headrail_length_mm: headrailParsed,
        job_card_supply_scope: scope,
      })
    } else if (action === 'reject' || action === 'void') {
      const outcome: PvcWorkflowClosedStatus = action === 'reject' ? 'rejected' : 'void'
      await closePvcQuoteFromDraft(
        admin,
        quoteId,
        user.id,
        actorName,
        outcome,
        String(body.closure_note ?? ''),
      )
    } else if (action === 'put_on_hold') {
      await setPvcQuoteOnHold(
        admin,
        quoteId,
        user.id,
        actorName,
        String(body.closure_note ?? body.approval_message ?? ''),
      )
    } else if (action === 'resume_draft') {
      await resumePvcQuoteFromHold(admin, quoteId, user.id, actorName)
    } else if (action === 'mark_shipped_or_installed') {
      await markPvcQuoteShippedOrInstalled(admin, quoteId, user.id, actorName)
    } else if (action === 'set_invoice') {
      await setPvcQuoteInvoiceStatus(
        admin,
        quoteId,
        user.id,
        actorName,
        body.invoice_status as PvcInvoiceStatus,
      )
    } else {
      return NextResponse.json({ error: 'Unknown workflow action.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}
