import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { buildJobCardPdfForQuote } from '@/lib/pvc/pvcQuoteWorkflowService'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    const staff = await requirePortalStaff()
    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Check access: manager/admin can print any; others can only print their own assigned job card
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', staff.user.id)
      .maybeSingle()

    const role = String((profile as { role?: string } | null)?.role ?? '').toLowerCase()
    const isManager = role === 'manager' || role === 'admin'

    if (!isManager) {
      const { data: quote } = await supabase
        .from('pvc_quotes')
        .select('assigned_user_id, workflow_status')
        .eq('id', quoteId)
        .maybeSingle()

      if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
      if (quote.assigned_user_id !== staff.user.id) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
      }
      if (!['approved', 'shipped_or_installed'].includes(String(quote.workflow_status))) {
        return NextResponse.json({ error: 'Job card not available.' }, { status: 403 })
      }
    }

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
