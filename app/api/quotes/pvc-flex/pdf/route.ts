import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { generatePvcFlexQuotePdf, type PvcFlexQuotePdfInput } from '@/lib/pdf/generatePvcFlexQuotePdf'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { resolveQuoteTcPdfBytes } from '@/lib/quotes/resolveQuoteTcPdfBytes'

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()

    const body = await request.json() as PvcFlexQuotePdfInput & { tcPdfBytes?: Buffer }

    const sb = createServiceRoleClient()
    body.tcPdfBytes = await resolveQuoteTcPdfBytes(sb, 'PVC_FLEX_SYSTEM', body.endUser) ?? undefined

    const pdfBytes = await generatePvcFlexQuotePdf(body)

    const safeName = (body.customerName || 'CUSTOMER')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50)
    const filename = `${body.quoteNumber}_${safeName}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to generate PDF.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
