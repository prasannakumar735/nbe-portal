import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'

export const runtime = 'nodejs'
export const maxDuration = 60

function parseEmails(raw: string): string[] {
  return raw.split(/[,;\n]/).map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

function buildHtml(params: {
  body: string
  senderName: string
  quoteNumber: string
  customerName: string
}): string {
  const bodyHtml = escapeHtml(params.body).replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NBE Quote</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <tr>
        <td style="background:#1e3a8a;padding:20px 28px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px">NBE Australia</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">Industrial Rapid Door Quotation</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;color:#111827;font-size:15px;line-height:1.7">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 28px;color:#6b7280;font-size:13px;line-height:1.6;border-top:1px solid #f3f4f6">
          <p style="margin:16px 0 4px"><strong style="color:#111827">${escapeHtml(params.senderName)}</strong></p>
          <p style="margin:0">NBE Australia Pty Ltd | ABN 17 007 048 008</p>
          <p style="margin:0">22A Humeside Drive, Campbellfield VIC 3061</p>
          <p style="margin:4px 0 0">Quote reference: <strong>${escapeHtml(params.quoteNumber)}</strong></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requirePortalStaff()

    const body = await request.json() as {
      to: string
      cc?: string
      subject: string
      emailBody: string
      pdfBase64?: string
      fileName?: string
      quoteNumber?: string
      customerName?: string
      attachPdf?: boolean
    }

    if (!body.to || !body.subject || !body.emailBody) {
      return NextResponse.json({ error: 'to, subject and emailBody are required.' }, { status: 400 })
    }

    const toList = parseEmails(body.to)
    if (toList.length === 0) {
      return NextResponse.json({ error: 'Enter at least one valid recipient email address.' }, { status: 400 })
    }

    const ccList = body.cc ? parseEmails(body.cc) : []

    // Resolve sender name from profiles
    const supabase = createServiceRoleClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', staff.user.id)
      .maybeSingle()
    const senderName = (profile as { full_name?: string | null } | null)?.full_name?.trim() || 'NBE Team'

    const attachments = []
    if (body.attachPdf !== false && body.pdfBase64 && body.fileName) {
      attachments.push({
        name: body.fileName,
        contentType: 'application/pdf',
        contentBytes: body.pdfBase64,
      })
    }

    const htmlBody = buildHtml({
      body: body.emailBody,
      senderName,
      quoteNumber: body.quoteNumber ?? '',
      customerName: body.customerName ?? '',
    })

    await sendMailViaGraph({
      to: toList.join('; '),
      cc: ccList.length > 0 ? ccList : undefined,
      subject: body.subject,
      bodyHtml: htmlBody,
      attachments,
    })

    return NextResponse.json({ ok: true, sent_to: toList, cc: ccList })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to send email.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
