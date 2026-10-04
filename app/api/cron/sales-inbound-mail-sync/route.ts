import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { resolveGraphMailboxUserId } from '@/lib/graph/graphAuth'
import { jsonError500 } from '@/lib/security/safeApiError'
import { runMailboxDeltaSyncPage } from '@/lib/sales/replies/mailboxDeltaSyncService'
import { upsertSalesMailboxSyncState } from '@/lib/sales/repositories/salesMailboxSyncStateRepository'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'




export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const supabase = createServiceRoleClient()
    const stats = await runMailboxDeltaSyncPage(supabase)

    return NextResponse.json({
      ok: true,
      ...stats,
    })
  } catch (e) {
    try {
      const supabase = createServiceRoleClient()
      const mailboxUserId = resolveGraphMailboxUserId()
      await upsertSalesMailboxSyncState(supabase, {
        mailbox_user_id: mailboxUserId,
        folder: 'Inbox',
        last_error: e instanceof Error ? e.message : String(e),
      })
    } catch {
      // ignore secondary persistence errors
    }
    return jsonError500(e, 'sales-inbound-mail-sync-cron')
  }
}
