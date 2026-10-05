import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth/server'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
import {
  approveServiceQuote,
  closeServiceQuoteFromDraft,
  markServiceQuoteCompleted,
  profileDisplayName,
  resumeServiceQuoteFromHold,
  setServiceQuoteInvoiceStatus,
  setServiceQuoteOnHold,
} from '@/lib/quotes/serviceQuoteWorkflowService'
import type { ServiceQuoteClosedStatus, ServiceQuoteInvoiceStatus } from '@/lib/quotes/serviceQuoteWorkflow'

export const runtime = 'nodejs'

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const user = await getServerUser()
  if (!user?.id) return fail('Unauthenticated', 401)

  const supabase = await createClient()
  const { quoteId } = await params

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })

  const assignedUserId = (quote.assigned_user_id as string | null) ?? null
  const assigneeName = assignedUserId ? await profileDisplayName(supabase, assignedUserId) : null

  return NextResponse.json({ ok: true, workflow: { ...quote, assigneeName } })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const user = await getServerUser()
  if (!user?.id) return fail('Unauthenticated', 401)

  const supabase = await createClient()

  const manager = await isManagerOrAdmin(supabase, user.id)
  if (!manager) return fail('Manager role required.', 403)

  const { quoteId } = await params
  if (!quoteId) return fail('Missing quoteId')

  const actorName = await profileDisplayName(supabase, user.id)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON')
  }

  const action = String(body.action ?? '')

  try {
    switch (action) {
      case 'approve':
        await approveServiceQuote(supabase, quoteId, user.id, actorName, {
          approval_po_reference: String(body.approval_po_reference ?? ''),
          approval_message: String(body.approval_message ?? ''),
          assigned_user_id: String(body.assigned_user_id ?? ''),
        })
        break

      case 'put_on_hold':
        await setServiceQuoteOnHold(supabase, quoteId, user.id, actorName, String(body.closure_note ?? ''))
        break

      case 'resume_draft':
        await resumeServiceQuoteFromHold(supabase, quoteId, user.id, actorName)
        break

      case 'reject':
        await closeServiceQuoteFromDraft(
          supabase, quoteId, user.id, actorName,
          'rejected' as ServiceQuoteClosedStatus,
          String(body.closure_note ?? ''),
        )
        break

      case 'void':
        await closeServiceQuoteFromDraft(
          supabase, quoteId, user.id, actorName,
          'void' as ServiceQuoteClosedStatus,
          String(body.closure_note ?? ''),
        )
        break

      case 'mark_completed':
        await markServiceQuoteCompleted(supabase, quoteId, user.id, actorName)
        break

      case 'set_invoice':
        await setServiceQuoteInvoiceStatus(
          supabase, quoteId, user.id, actorName,
          String(body.invoice_status ?? '') as ServiceQuoteInvoiceStatus,
        )
        break

      default:
        return fail(`Unknown action: ${action}`)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Workflow action failed.', 400)
  }
}
