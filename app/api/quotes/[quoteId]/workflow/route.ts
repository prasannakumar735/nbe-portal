import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { exportServiceWorkflowFields, profileDisplayName } from '@/lib/quotes/serviceQuoteWorkflowService'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Generic workflow-state fetch for any `quotes` row (General/Parts/Maintenance/PVC Flex/
 * Rapid Door/Service), independent of the `quote_items` table used only by the legacy
 * Service quote builder. Transitions themselves go through the shared
 * `/api/quotes/service/[quoteId]/workflow` action endpoint, which is already generic.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    await requirePortalStaff()

    const { quoteId } = await context.params
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote id.' }, { status: 400 })
    }

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
