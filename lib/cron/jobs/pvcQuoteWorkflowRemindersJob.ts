import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { sendManagerDraftPvcFollowUpEmail } from '@/lib/email/sendPvcDraftFollowUpEmail'
import { sendManagerPendingPvcEmail } from '@/lib/email/sendPvcPendingActionEmail'
import {
  listPvcQuotesNeedingDraftFollowUpEmail,
  listPvcQuotesPendingShipment,
} from '@/lib/pvc/pvcQuoteWorkflowService'

export async function runPvcQuoteWorkflowRemindersJob(): Promise<Record<string, unknown>> {
  const supabase = createServiceRoleClient()

  const draftRows = await listPvcQuotesNeedingDraftFollowUpEmail(supabase, 2)
  if (draftRows.length > 0) {
    await sendManagerDraftPvcFollowUpEmail(supabase, draftRows)
    const draftIds = draftRows.map(r => r.id)
    await supabase
      .from('pvc_quotes')
      .update({ draft_follow_up_notified_at: new Date().toISOString() })
      .in('id', draftIds)
  }

  const pendingShip = await listPvcQuotesPendingShipment(supabase, 3)
  const shipToNotify = pendingShip.filter(
    r => r.id,
  )
  if (shipToNotify.length > 0) {
    await sendManagerPendingPvcEmail(supabase, shipToNotify)
    const shipIds = shipToNotify.map(r => r.id)
    await supabase
      .from('pvc_quotes')
      .update({ pending_action_notified_at: new Date().toISOString() })
      .in('id', shipIds)
  }

  return {
    ok: true,
    draftFollowUpNotified: draftRows.length,
    pendingShipmentNotified: shipToNotify.length,
  }
}
