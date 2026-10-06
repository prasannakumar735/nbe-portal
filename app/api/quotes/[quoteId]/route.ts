import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

const DRAFT_STATUSES = ['draft', 'draft_review']

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  try {
    await requirePortalStaff()
    const { quoteId } = await params
    if (!quoteId) return NextResponse.json({ error: 'quoteId required.' }, { status: 400 })

    const supabase = createServiceRoleClient()

    // Fetch current status first — only draft quotes may be deleted
    const { data: row, error: fetchErr } = await supabase
      .from('quotes')
      .select('id, workflow_status, quote_number')
      .eq('id', quoteId)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!row) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })

    if (!DRAFT_STATUSES.includes(row.workflow_status ?? '')) {
      return NextResponse.json(
        { error: `Cannot delete quote ${row.quote_number} — it is in "${row.workflow_status}" status. Only draft quotes can be deleted.` },
        { status: 403 },
      )
    }

    const { error: delErr } = await supabase.from('quotes').delete().eq('id', quoteId)
    if (delErr) throw delErr

    return NextResponse.json({ ok: true })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to delete quote.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
