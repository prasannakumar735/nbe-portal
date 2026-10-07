import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'
import { generatePvcJobCardPdf, type PvcJobCardPdfInput } from '@/lib/pdf/generatePvcJobCardPdf'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function buildHtml(p: {
  assigneeName: string
  customerName: string
  poReference: string | null
  approvalMessage: string | null
  quoteUrl: string
}): string {
  const customer = escapeHtml(p.customerName || 'a customer')
  const po = p.poReference ? `<p style="margin:0 0 12px"><strong>PO / Reference:</strong> ${escapeHtml(p.poReference)}</p>` : ''
  const notes = p.approvalMessage
    ? `<p style="margin:16px 0 4px"><strong>Notes:</strong></p>
       <p style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border-left:3px solid #1e3a8a;border-radius:4px">${escapeHtml(p.approvalMessage)}</p>`
    : ''
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NBE Portal</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <tr>
        <td style="background:#1e3a8a;padding:20px 28px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px">NBE Portal</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">PVC Strip Curtain — Job Card</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 24px;color:#111827;font-size:15px;line-height:1.6">
          <p style="margin:0 0 16px">Hi ${escapeHtml(p.assigneeName)},</p>
          <p style="margin:0 0 16px">A PVC Strip Curtain job card has been assigned to you for <strong>${customer}</strong>. The job card PDF is attached to this email.</p>
          ${po}${notes}
          <p style="margin:24px 0 0">
            <a href="${escapeHtml(p.quoteUrl)}" style="display:inline-block;background:#1e3a8a;color:#fff;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none">View quote &amp; job card</a>
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
}

export async function sendPvcJobCardAssignmentEmail(
  supabase: SupabaseClient,
  params: {
    assigneeUserId: string
    assigneeName: string
    customerName: string
    quoteId: string
    poReference: string | null
    approvalMessage: string | null
    jobCardPdfInput: PvcJobCardPdfInput
  },
): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string }> {
  const { data: userData, error } = await supabase.auth.admin.getUserById(params.assigneeUserId)
  if (error) return { status: 'failed', reason: error.message }
  const email = String(userData.user?.email ?? '').trim()
  if (!isValidEmail(email)) return { status: 'skipped', reason: 'Assignee has no valid email.' }

  const quoteUrl = `${publicAppBaseUrl()}/pvc-calculator/${params.quoteId}/edit`
  const html = buildHtml({
    assigneeName: params.assigneeName,
    customerName: params.customerName,
    poReference: params.poReference,
    approvalMessage: params.approvalMessage,
    quoteUrl,
  })

  let pdfBytes: Uint8Array | null = null
  try {
    pdfBytes = await generatePvcJobCardPdf(params.jobCardPdfInput)
  } catch {
    // Send email without attachment rather than failing entirely
  }

  await sendMailViaGraph({
    to: email,
    subject: `PVC Job Card assigned: ${params.customerName || 'New quote'}`,
    bodyHtml: html,
    attachments: pdfBytes
      ? [{ name: `PVC_JobCard_${params.quoteId.slice(0, 8)}.pdf`, contentType: 'application/pdf', contentBytes: Buffer.from(pdfBytes).toString('base64') }]
      : [],
  })

  return { status: 'sent' }
}
