import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { buildJobCardPdfForQuote } from '@/lib/pvc/pvcQuoteWorkflowService'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    await requirePortalStaff()
    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const pdfBytes = await buildJobCardPdfForQuote(supabase, quoteId)

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PVC_JobCard_${quoteId.slice(0, 8)}.pdf"`,
      },
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to generate job card PDF.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
