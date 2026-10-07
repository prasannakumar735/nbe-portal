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
import { sendMailViaGraph, type GraphSendMailAttachment } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'
import { generateServicePvcJobCardPdf, type ServicePvcJobCardDoor as PvcJobCardDoor } from '@/lib/pdf/generateServicePvcJobCardPdf'
import { calcPvcNewQuote, autoRaisedHeadrailSize } from '@/lib/pvc/pvcNewQuoteCalculator'

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

async function sendNotInvoicedEmail(params: {
  quoteNumber: string
  quoteId: string
  customerName: string
  description: string
  assigneeName: string | null
  contactName: string
  actorName: string
  date: string
}): Promise<void> {
  const quoteUrl = `${publicAppBaseUrl()}/quotes?q=${encodeURIComponent(params.quoteNumber)}`
  const contactLine = params.contactName
    ? `<p style="margin:0 0 8px"><strong>Contact Person:</strong> ${escapeHtml(params.contactName)}</p>`
    : ''
  const html = `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NBE Portal</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
      <tr><td style="background:#1e3a5f;padding:24px 32px">
        <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff">NBE Australia</p>
      </td></tr>
      <tr><td style="padding:32px">
        <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi Accounts Team,</p>
        <p style="margin:0 0 24px;color:#475569">The following quote has been completed and is ready to invoice.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:6px;padding:20px;margin-bottom:24px">
          <tr><td style="padding:4px 0"><p style="margin:0 0 8px"><strong>Quote Number:</strong> ${escapeHtml(params.quoteNumber)}</p></td></tr>
          <tr><td style="padding:4px 0"><p style="margin:0 0 8px"><strong>Client:</strong> ${escapeHtml(params.customerName)}</p></td></tr>
          ${contactLine ? `<tr><td style="padding:4px 0">${contactLine}</td></tr>` : ''}
          <tr><td style="padding:4px 0"><p style="margin:0 0 8px"><strong>Description:</strong> ${escapeHtml(params.description)}</p></td></tr>
          <tr><td style="padding:4px 0"><p style="margin:0 0 8px"><strong>Completed by:</strong> ${escapeHtml(params.assigneeName ?? 'N/A')}</p></td></tr>
          <tr><td style="padding:4px 0"><p style="margin:0 0 8px"><strong>Marked not invoiced by:</strong> ${escapeHtml(params.actorName)}</p></td></tr>
          <tr><td style="padding:4px 0"><p style="margin:0"><strong>Date:</strong> ${escapeHtml(params.date)}</p></td></tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr><td style="background:#1e3a5f;border-radius:6px;padding:12px 24px">
            <a href="${quoteUrl}" style="color:#ffffff;font-weight:600;text-decoration:none;font-size:14px">View Quote →</a>
          </td></tr>
        </table>
        <p style="margin:0 0 24px;color:#475569">Please process the invoice at your earliest convenience.</p>
        <p style="margin:0;color:#94a3b8;font-size:13px">Regards,<br>NBE Australia Portal</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  await sendMailViaGraph({
    to: 'accounts@nbeaustralia.com.au',
    subject: `Quote Ready to Invoice — ${params.quoteNumber} | ${params.customerName}`,
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
        // Generate PVC job card PDF and email to technician (best-effort)
        try {
          const srClient2 = createServiceRoleClient()
          const { data: qRow } = await srClient2
            .from('quotes')
            .select('quote_number, quote_type, customer_name, site_address, form_snapshot, approval_po_reference')
            .eq('id', quoteId)
            .maybeSingle()
          const qr = qRow as Record<string, unknown> | null
          if (qr && String(qr.quote_type ?? '') === 'PVC_FLEX_SYSTEM') {
            // ── Generate job card number JC-YYMMDD-NNN ────────────────────────
            const today = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
            }).format(new Date()).replace(/-/g, '').slice(2)   // YYMMDD
            const { data: existing } = await srClient2
              .from('quotes')
              .select('job_card_number')
              .like('job_card_number', `JC-${today}-%`)
            const nextSeq = ((existing ?? []).length) + 1
            const jobCardNumber = `JC-${today}-${String(nextSeq).padStart(3, '0')}`
            await srClient2.from('quotes').update({ job_card_number: jobCardNumber }).eq('id', quoteId)

            // ── Build door specs from form_snapshot ───────────────────────────
            const snap = qr.form_snapshot as Record<string, unknown> | null
            type SnapDoor = {
              id: string; openingW: string; openingH: string
              stripWidth: number; thickness: number
              grade: 'Ambient' | 'Freezer'
              profile: 'Ribbed' | 'Flat' | 'Coloured'
              hanger: 'Galvanised' | 'Stainless Steel'
              supplyType: 'Complete Door' | 'Strip Curtain Only' | 'Headrail Only'
              mountingType: 'Face Fixed' | 'Soffit Fixed'
              sliding: 'NA' | 'Single' | 'Dual'
              raisedHeadrail: boolean
              qty: number
            }
            const snapDoors = (snap?.savedPvcDoors ?? []) as SnapDoor[]
            const jobCardDoors: PvcJobCardDoor[] = snapDoors
              .filter(d => d.openingW && d.openingH)
              .map((d, i) => {
                const raisedHR = d.raisedHeadrail ? autoRaisedHeadrailSize(parseFloat(d.openingW) || 0) : ('NA' as const)
                const calc = calcPvcNewQuote({
                  openingW: parseFloat(d.openingW) || 0,
                  openingH: parseFloat(d.openingH) || 0,
                  stripWidth: d.stripWidth, thickness: d.thickness,
                  grade: d.grade, profile: d.profile, hanger: d.hanger,
                  supplyType: d.supplyType, mountingType: d.mountingType,
                  sliding: d.sliding, raisedHeadrail: raisedHR,
                })
                const headrailLabel = d.supplyType === 'Strip Curtain Only' ? 'N/A' : d.hanger
                return {
                  label:         `Door ${i + 1}`,
                  materialType:  d.grade === 'Freezer' ? 'Coolroom' : 'Standard',
                  profile:       d.profile,
                  stripSizeMm:   d.stripWidth,
                  thicknessMm:   d.thickness,
                  stripLengthMm: calc.cutLengthMm,
                  stripCount:    calc.numStrips,
                  application:   d.supplyType,
                  rivetsHangers: d.hanger,
                  doorWidthMm:   parseFloat(d.openingW) || 0,
                  doorHeightMm:  parseFloat(d.openingH) || 0,
                  headrail:      headrailLabel,
                  qty:           d.qty || 1,
                }
              })

            const quoteNumber  = String(qr.quote_number ?? '')
            const customerName = String(qr.customer_name ?? '')
            const siteAddress  = String(qr.site_address ?? '')
            const poRef        = String(qr.approval_po_reference ?? String(snap?.poReference ?? ''))
            const custAttn     = String(snap?.custAttn ?? '')
            const pvcNotes     = String(snap?.pvcTerms ?? '')
            const dateStr      = new Date().toLocaleDateString('en-AU', {
              day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne',
            })

            const pdfBytes = await generateServicePvcJobCardPdf({
              jobCardNumber,
              quoteNumber,
              status:          'APPROVED',
              assignedToName:  (await profileDisplayName(srClient2, assignedUserId)).toUpperCase(),
              poReference:     poRef,
              jobName:         `${customerName}${customerName && quoteNumber ? ' – ' : ''}${quoteNumber}`,
              createdDate:     dateStr,
              requiredBy:      '',
              customerName,
              siteContact:     custAttn,
              siteAddress,
              customerReference: poRef,
              importantNote:   pvcNotes,
              doors:           jobCardDoors,
            })

            // ── Email job card to technician ──────────────────────────────────
            if (assignedUserId) {
              const { data: techUser } = await srClient2.auth.admin.getUserById(assignedUserId)
              const techEmail = String(techUser?.user?.email ?? '').trim()
              if (techEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(techEmail)) {
                const attachment: GraphSendMailAttachment = {
                  name: `JobCard_${jobCardNumber}.pdf`,
                  contentType: 'application/pdf',
                  contentBytes: Buffer.from(pdfBytes).toString('base64'),
                }
                const techName = await profileDisplayName(srClient2, assignedUserId)
                await sendMailViaGraph({
                  to: techEmail,
                  subject: `Job Card ${jobCardNumber} — ${customerName}`,
                  bodyHtml: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1a1a1a">
<p>Hi ${escapeHtml(techName)},</p>
<p>Please find attached your manufacturing job card for the following job:</p>
<table style="border-collapse:collapse;margin:16px 0">
  <tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px">Job Card</td><td style="padding:4px 0;font-size:13px"><strong>${escapeHtml(jobCardNumber)}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px">Quote</td><td style="padding:4px 0;font-size:13px">${escapeHtml(quoteNumber)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px">Customer</td><td style="padding:4px 0;font-size:13px">${escapeHtml(customerName)}</td></tr>
  ${siteAddress ? `<tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px">Site</td><td style="padding:4px 0;font-size:13px">${escapeHtml(siteAddress)}</td></tr>` : ''}
</table>
<p>Please review the job card carefully before starting manufacturing.</p>
<p>Regards,<br>NBE Australia</p>
</body></html>`,
                  attachments: [attachment],
                })
              }
            }
          }
        } catch (jcErr) {
          console.error('[pvc-job-card]', jcErr)
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

      case 'clear_invoice': {
        const { error: clrErr } = await supabase
          .from('quotes')
          .update({ invoice_status: null, invoice_status_at: null, updated_at: new Date().toISOString() })
          .eq('id', quoteId)
        if (clrErr) throw clrErr
        break
      }

      case 'set_invoice': {
        const invoiceStatus = String(body.invoice_status ?? '') as ServiceQuoteInvoiceStatus
        await setServiceQuoteInvoiceStatus(supabase, quoteId, user.id, actorName, invoiceStatus)
        if (invoiceStatus === 'not_invoiced') {
          try {
            const srClient = createServiceRoleClient()
            const { data: q } = await srClient
              .from('quotes')
              .select('quote_number, customer_name, form_snapshot, assigned_user_id')
              .eq('id', quoteId)
              .maybeSingle()
            if (q) {
              const row = q as Record<string, unknown>
              const assignedUserId = row.assigned_user_id as string | null
              const assigneeName = assignedUserId ? await profileDisplayName(srClient, assignedUserId) : null
              const snap = row.form_snapshot as Record<string, unknown> | null
              const contactName = String(snap?.contactPerson ?? '').trim()
              const description = String(snap?.scopeOfWork ?? snap?.description ?? snap?.title ?? '').trim() || 'No description'
              const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' })
              await sendNotInvoicedEmail({
                quoteNumber: String(row.quote_number ?? ''),
                quoteId,
                customerName: String(row.customer_name ?? ''),
                description,
                assigneeName,
                contactName,
                actorName,
                date,
              })
            }
          } catch (emailErr) {
            console.error('[not_invoiced email]', emailErr)
          }
        }
        break
      }

      default:
        return fail(`Unknown action: ${action}`)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Workflow action failed.', 400)
  }
}
