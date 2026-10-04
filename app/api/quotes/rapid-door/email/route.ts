import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import fs from 'fs'
import path from 'path'


export const maxDuration = 60

function parseEmails(raw: string): string[] {
  return raw.split(/[,;\n]/).map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'NBE_Logo_2026_wbg.png')
    const buf = fs.readFileSync(logoPath)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return ''
  }
}

function buildHtml(params: {
  body: string
  senderName: string
  quoteNumber: string
  customerName: string
  sigHtml?: string
}): string {
  const bodyHtml = escapeHtml(params.body).replace(/\n/g, '<br>')
  const logoSrc = getLogoBase64()
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="NBE Australia" style="height:48px;max-width:180px;display:block">`
    : `<span style="font-size:18px;font-weight:700;color:#1e3a8a">NBE Australia</span>`

  // Process sigHtml: constrain images, remove any script/style blocks
  const processSig = (html: string) => html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Force block display on img so they never render mid-line next to text
    .replace(/<img([^>]*?)>/gi, (_m, attrs) => {
      const stripped = attrs.replace(/\bstyle="[^"]*"/gi, '').replace(/\bdisplay=\S+/gi, '')
      return `<img${stripped} style="display:block;max-height:56px;max-width:200px;margin:4px 0">`
    })

  const sigSection = params.sigHtml
    ? `<tr>
        <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;font-size:13px;color:#374151;line-height:1.65">
          ${processSig(params.sigHtml)}
        </td>
       </tr>`
    : ''

  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NBE Quote</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:36px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.10)">

      <!-- Header: logo + thin accent line -->
      <tr>
        <td style="padding:24px 32px 20px;background:#ffffff;border-bottom:3px solid #1e3a8a">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>${logoHtml}</td>
              <td align="right" style="font-size:11px;color:#6b7280;vertical-align:bottom;padding-bottom:4px">
                Industrial Rapid Door Quotation
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:28px 32px 20px;color:#111827;font-size:15px;line-height:1.75">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Signature (HTML from editor) -->
      ${sigSection}

      <!-- Footer -->
      <tr>
        <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;color:#6b7280;line-height:1.6">
          <strong style="color:#374151">NBE Australia Pty Ltd</strong> | ABN 17 007 048 008<br>
          22A Humeside Drive, Campbellfield VIC 3061
          ${params.quoteNumber ? `<br>Quote reference: <strong style="color:#374151">${escapeHtml(params.quoteNumber)}</strong>` : ''}
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
      sigHtml?: string
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
      sigHtml: body.sigHtml,
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
