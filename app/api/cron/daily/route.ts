import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { runCalendarRemindersJob } from '@/lib/cron/jobs/calendarRemindersJob'
import { runForgottenOfficeCloseJob } from '@/lib/cron/jobs/forgottenOfficeCloseJob'
import { runServiceDueRemindersJob } from '@/lib/cron/jobs/serviceDueRemindersJob'
import { runPvcQuoteWorkflowRemindersJob } from '@/lib/cron/jobs/pvcQuoteWorkflowRemindersJob'
import { runDoorServiceAlertsJob } from '@/lib/cron/jobs/doorServiceAlertsJob'
import { runWeeklyTimesheetRemindersJob } from '@/lib/cron/jobs/weeklyTimesheetRemindersJob'
import { jsonError500 } from '@/lib/security/safeApiError'
import { dispatchEmailSendQueue } from '@/lib/sales/sending/emailSendQueueDispatcher'
import { dispatchFollowupQueue } from '@/lib/sales/followup/followupQueueDispatcher'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import { syncCampaignEngagementFromDeliveryArtifacts } from '@/lib/sales/engagement/syncDeliveryEngagement'
import { runMailboxDeltaSyncPage } from '@/lib/sales/replies/mailboxDeltaSyncService'
import { resolveGraphMailboxUserId } from '@/lib/graph/graphAuth'
import { listSalesEmailSendQueue } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { purgeSoftDeletedMergedReportsOlderThan } from '@/lib/merged-reports/deleteMergedReport'




type JobResult = Record<string, unknown> | { ok: false; error: string }

async function runJobSafe(
  name: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<JobResult> {
  try {
    return await fn()
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : `${name} failed`,
    }
  }
}

/** Vercel Hobby: single daily cron entry runs all portal scheduled jobs. */
export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const ranAt = new Date().toISOString()
    const supabase = createServiceRoleClient()

    // ── Portal jobs ──────────────────────────────────────────────────────────
    const forgottenOfficeClose = await runJobSafe('forgottenOfficeClose', runForgottenOfficeCloseJob)
    const calendarReminders = await runJobSafe('calendarReminders', runCalendarRemindersJob)
    const serviceDueReminders = await runJobSafe('serviceDueReminders', runServiceDueRemindersJob)
    const weeklyTimesheetReminders = await runJobSafe(
      'weeklyTimesheetReminders',
      runWeeklyTimesheetRemindersJob,
    )
    const pvcQuoteWorkflowReminders = await runJobSafe(
      'pvcQuoteWorkflowReminders',
      runPvcQuoteWorkflowRemindersJob,
    )
    const doorServiceAlerts = await runJobSafe('doorServiceAlerts', runDoorServiceAlertsJob)

    // ── Sales Engine jobs ────────────────────────────────────────────────────
    // Run sequentially so each job operates on an up-to-date queue state.
    // Failures are isolated — one job failing doesn't skip the rest.

    const salesEmailSend = await runJobSafe('salesEmailSend', async () => {
      const { results } = await dispatchEmailSendQueue(supabase, { limit: 15 })
      return { processed: results.length }
    })

    const salesFollowupDispatch = await runJobSafe('salesFollowupDispatch', async () => {
      const { results } = await dispatchFollowupQueue(supabase, { limit: 10 })
      return { processed: results.length }
    })

    const salesJobs = await runJobSafe('salesJobs', async () => {
      const results = await processSalesJobs(supabase, { limit: 20 })
      return { processed: results.length }
    })

    const salesEngagementSync = await runJobSafe('salesEngagementSync', async () => {
      const queues = await listSalesEmailSendQueue(supabase, { limit: 500 })
      const campaignIds = [...new Set(queues.map((q) => q.campaign_id))]
      let synced = 0
      for (const id of campaignIds) {
        await syncCampaignEngagementFromDeliveryArtifacts(supabase, id)
        synced++
      }
      return { campaigns: synced }
    })

    const salesInboundMailSync = await runJobSafe('salesInboundMailSync', async () => {
      const mailboxUserId = resolveGraphMailboxUserId()
      const result = await runMailboxDeltaSyncPage(supabase, { mailboxUserId })
      return { messagesProcessed: result.messagesProcessed }
    })

    const purgeMergedReports = await runJobSafe('purgeMergedReports', async () => {
      const result = await purgeSoftDeletedMergedReportsOlderThan(supabase, 30)
      return { purged: result.purged, errors: result.errors }
    })

    const jobs = {
      forgottenOfficeClose,
      calendarReminders,
      serviceDueReminders,
      weeklyTimesheetReminders,
      pvcQuoteWorkflowReminders,
      doorServiceAlerts,
      salesEmailSend,
      salesFollowupDispatch,
      salesJobs,
      salesEngagementSync,
      salesInboundMailSync,
      purgeMergedReports,
    }

    const anyHardFail = Object.values(jobs).some(
      j => j && typeof j === 'object' && j.ok === false && 'error' in j,
    )

    return NextResponse.json({
      ok: !anyHardFail,
      ranAt,
      jobs,
    })
  } catch (e) {
    return jsonError500(e, 'cron-daily')
  }
}
