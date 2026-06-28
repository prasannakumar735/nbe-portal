import { NextResponse } from 'next/server'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
import { runPvcQuoteWorkflowRemindersJob } from '@/lib/cron/jobs/pvcQuoteWorkflowRemindersJob'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { listPvcQuotesPendingShipment } from '@/lib/pvc/pvcQuoteWorkflowService'

export async function GET() {
  try {
    const { supabase, user } = await requirePortalStaff()
    const manager = await isManagerOrAdmin(supabase, user.id)
    const admin = createServiceRoleClient()
    const pending = await listPvcQuotesPendingShipment(admin, 3)

    return NextResponse.json({
      isManager: manager,
      pendingApprovalFollowUp: pending,
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: 'Failed to load pending actions.' }, { status: 400 })
  }
}

/** Optional cron: notify managers about approved quotes not shipped (Bearer CRON_SECRET). */
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim()
    const auth = request.headers.get('authorization')
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runPvcQuoteWorkflowRemindersJob()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed.' },
      { status: 500 },
    )
  }
}
