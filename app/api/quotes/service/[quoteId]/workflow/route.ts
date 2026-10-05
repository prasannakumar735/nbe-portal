import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth/server'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import {
  approveServiceQuote,
  closeServiceQuoteFromDraft,
  exportServiceWorkflowFields,
  markServiceQuoteCompleted,
  profileDisplayName,
  resumeServiceQuoteFromHold,
  revertServiceQuoteToDraft,
  setServiceQuoteInvoiceStatus,
  setServiceQuoteOnHold,
} from '@/lib/quotes/serviceQuoteWorkflowService'
import type { ServiceQuoteClosedStatus, ServiceQuoteInvoiceStatus } from '@/lib/quotes/serviceQuoteWorkflow'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function sendQuoteApprovalEmail(params: {
  assigneeEmail: string
  assigneeName: string
  approverName: string
  customerName: string
  quoteNumber: string
  quoteId: string
  poReference: string
  approvalMessage: string
}): Promise<void> {
  const quoteUrl = `${publicAppBaseUrl()}/quotes?q=${encodeURIComponent(params.quoteNumber)}`
  const po = params.poReference
    ? `<p style="margin:0 0 12px"><strong>PO / Reference:</strong> ${escapeHtml(params.poReference)}</p>`
    : ''
  const notes = params.approvalMessage
    ? `<p style="margin:16px 0 4px"><strong>Notes from manager:</strong></p>
       <p style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border-left:3px solid #1e3a8a;border-radius:4px">${escapeHtml(params.approvalMessage)}</p>`
    : ''
  const html = `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NBE Portal</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <tr>
        <td style="background:#1e3a8a;padding:20px 28px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px">NBE Australia</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">Quote Approved &amp; Assigned</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 24px;color:#111827;font-size:15px;line-height:1.6">
          <p style="margin:0 0 16px">Hi ${escapeHtml(params.assigneeName)},</p>
          <p style="margin:0 0 16px">Quote <strong>${escapeHtml(params.quoteNumber)}</strong> for <strong>${escapeHtml(params.customerName || 'a customer')}</strong> has been approved and assigned to you by ${escapeHtml(params.approverName)}.</p>
          ${po}${notes}
          <p style="margin:24px 0 0">
            <a href="${escapeHtml(quoteUrl)}" style="display:inline-block;background:#1e3a8a;color:#fff;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none">View Quote</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
          This is an automated notification from the NBE Portal. Do not reply to this email.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`

  await sendMailViaGraph({
    to: params.assigneeEmail,
    subject: `Quote assigned: ${params.quoteNumber} — ${params.customerName || 'New quote'}`,
    bodyHtml: html,
  })
}

/**
 * Generic workflow-state fetch for any `quotes` row (General/Parts/Maintenance/PVC Flex/
 * Rapid Door/Service), independent of the `quote_items` table used only by the legacy
 * Service quote builder's own GET route.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    await requirePortalStaff()

    const { quoteId } = await params
    const supabase = createServiceRoleClient()
    const { data: quote, error } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()

    if (error) throw error
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
    }

    const assignedUserId = (quote.assigned_user_id as string | null) ?? null
    const assigneeName = assignedUserId ? await profileDisplayName(supabase, assignedUserId) : null
    const workflow = 'workflow_status' in quote
      ? exportServiceWorkflowFields(quote as Record<string, unknown>, assigneeName)
      : null

    return NextResponse.json({ ok: true, workflow })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to load workflow state.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
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
      case 'approve': {
        const assignedUserId = String(body.assigned_user_id ?? '')
        const poReference    = String(body.approval_po_reference ?? '')
        const approvalMsg    = String(body.approval_message ?? '')
        await approveServiceQuote(supabase, quoteId, user.id, actorName, {
          approval_po_reference: poReference,
          approval_message: approvalMsg,
          assigned_user_id: assignedUserId,
        })
        // Send notification email to assignee (best-effort — don't fail the approval if email fails)
        let emailStatus: string | null = null
        if (assignedUserId) {
          try {
            const srClient = createServiceRoleClient()
            const [{ data: userData }, { data: quoteRow }] = await Promise.all([
              srClient.auth.admin.getUserById(assignedUserId),
              srClient.from('quotes').select('quote_number,customer_name').eq('id', quoteId).maybeSingle(),
            ])
            const assigneeEmail = String(userData?.user?.email ?? '').trim()
            const assigneeName  = await profileDisplayName(srClient, assignedUserId)
            if (!assigneeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assigneeEmail)) {
              emailStatus = `skipped:no_email_for_user`
            } else {
              await sendQuoteApprovalEmail({
                assigneeEmail,
                assigneeName,
                approverName: actorName,
                customerName: String((quoteRow as Record<string,unknown> | null)?.customer_name ?? ''),
                quoteNumber:  String((quoteRow as Record<string,unknown> | null)?.quote_number ?? quoteId),
                quoteId,
                poReference,
                approvalMessage: approvalMsg,
              })
              emailStatus = `sent:${assigneeEmail}`
            }
          } catch (emailErr) {
            emailStatus = `failed:${emailErr instanceof Error ? emailErr.message : String(emailErr)}`
          }
        }
        return NextResponse.json({ ok: true, emailStatus })
      }

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

      case 'revert_to_draft':
        await revertServiceQuoteToDraft(supabase, quoteId, user.id, actorName, String(body.note ?? ''))
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
