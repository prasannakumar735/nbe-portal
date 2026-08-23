import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { parsePVCCalculatorSnapshot } from '@/lib/pvc/pvcCalculatorSnapshot'
import { snapshotToQuoteData } from '@/lib/pvc/snapshotToQuoteData'
import { generateQuotePdf } from '@/lib/pdf/generateQuotePdf'
import { sendPvcQuoteToManager } from '@/lib/email/sendPvcQuoteToManager'

export const runtime = 'nodejs'
export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  /** Comma-separated list of recipient email addresses. */
  recipient_emails: z.string().min(1),
  /** Email body text (pre-filled but editable by the user). */
  email_body: z.string().min(1),
  /** Whether to attach the generated quote PDF. */
  attach_pdf: z.boolean().default(true),
})

function parseEmails(raw: string): string[] {
  return raw
    .split(',')
    .map(e => e.trim())
    .filter(e => e.includes('@') && e.length > 3)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ quoteId: string }> },
) {
  try {
    const staff = await requirePortalStaff()

    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const raw = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload' },
        { status: 400 },
      )
    }

    const recipientEmails = parseEmails(parsed.data.recipient_emails)
    if (recipientEmails.length === 0) {
      return NextResponse.json({ error: 'Enter at least one valid email address.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Load the quote
    const { data: quote, error: quoteError } = await supabase
      .from('pvc_quotes')
      .select('id, customer_name, form_snapshot, ref_no')
      .eq('id', quoteId)
      .maybeSingle()

    if (quoteError) throw quoteError
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
    }

    // Generate PDF only if requested
    let pdfBytes: Buffer | null = null
    let pdfFileName = 'PVC-Quote.pdf'

    if (parsed.data.attach_pdf) {
      if (!quote.form_snapshot) {
        return NextResponse.json({ error: 'Quote has no saved data to generate PDF from.' }, { status: 400 })
      }
      const snapshot = parsePVCCalculatorSnapshot(quote.form_snapshot)
      const quoteData = snapshotToQuoteData(snapshot)
      const bytes = await generateQuotePdf(quoteData)
      pdfBytes = Buffer.from(bytes)

      const customer = snapshot.formValues.customer.trim() || 'Quote'
      const refNo = snapshot.formValues.refNo.trim()
      pdfFileName = refNo
        ? `PVC-Quote-${refNo}.pdf`
        : `PVC-Quote-${customer.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
    }

    // Resolve sender info
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', staff.user.id)
      .maybeSingle()

    const senderName =
      String((senderProfile as { full_name?: string | null } | null)?.full_name ?? '').trim() || 'NBE Team'

    const senderEmail = staff.user.email ?? (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '')

    await sendPvcQuoteToManager({
      senderName,
      senderEmail,
      recipientEmails,
      emailBody: parsed.data.email_body,
      pdfBytes,
      pdfFileName,
    })

    return NextResponse.json({ ok: true, sent_to: recipientEmails })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
