import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import { isTimesheetRemindersDisabled } from '@/lib/notifications/isTimesheetRemindersDisabled'
import {
  notifyTimesheetAutoSubmittedEmployee,
  notifyTimesheetAutoSubmittedManagersBatch,
  notifyTimesheetManagerDigest,
  notifyTimesheetReminder1,
  notifyTimesheetReminder2,
  type AutoSubmittedEmployee,
  type DigestPendingRow,
} from '@/lib/notifications/timesheetReminderEmails'
import { submitWeeklyTimesheet } from '@/lib/timecard/submitWeeklyTimesheet'
import {
  currentWeekStartMelbourne,
  isAutoSubmitDue,
  isManagerDigestWindow,
  isReminder1Window,
  isReminder2Day,
  priorWeekStart,
} from '@/lib/timecard/weeklyReminderSchedule'
import { hasLoggedHours, isInactiveWeekForAutomation } from '@/lib/timecard/weekActivity'
import {
  displayNameFromProfile,
  loadEligibleTimesheetProfiles,
  resolveAuthEmail,
  sheetIsPending,
  type TimesheetCronRow,
} from '@/lib/timecard/timesheetCronHelpers'

export async function runWeeklyTimesheetRemindersJob(): Promise<Record<string, unknown>> {
  if (isTimesheetRemindersDisabled()) {
    return {
      ok: true,
      skipped: true,
      reason: 'notifications disabled (local testing)',
    }
  }

  const supabase = createServiceRoleClient()
  const now = new Date()
  const todayMelb = melbourneCalendarDate(now)
  const currentWeek = currentWeekStartMelbourne(now)
  const priorWeek = priorWeekStart(todayMelb)

  const errors: string[] = []
  let sentR1 = 0
  let sentR2 = 0
  let autoSubmitted = 0
  let digestSent = 0

  const profiles = await loadEligibleTimesheetProfiles(supabase)
  const profileById = new Map(profiles.map(p => [String(p.id), p]))

  async function processReminder(
    kind: 1 | 2,
    weekStart: string,
    flagCol: 'reminder_1_sent_at' | 'reminder_2_sent_at',
  ): Promise<number> {
    const { data: sheets, error: qErr } = await supabase
      .from('employee_weekly_timesheets')
      .select(
        'id, user_id, week_start_date, week_end_date, total_hours, status, reminder_1_sent_at, reminder_2_sent_at, auto_submitted_at',
      )
      .eq('week_start_date', weekStart)
      .in('status', ['draft', 'rejected'])
      .is(flagCol, null)

    if (qErr) {
      errors.push(`${kind}: query ${qErr.message}`)
      return 0
    }

    let count = 0
    for (const raw of sheets ?? []) {
      const row = raw as TimesheetCronRow
      if (!profileById.has(String(row.user_id))) continue
      if (!hasLoggedHours(row.total_hours)) continue
      if (!sheetIsPending(row.status)) continue

      const inactive = await isInactiveWeekForAutomation(
        supabase,
        String(row.user_id),
        String(row.week_start_date),
        String(row.week_end_date),
        { id: String(row.id), total_hours: row.total_hours },
      )
      if (inactive) continue

      const profile = profileById.get(String(row.user_id))!
      const email = await resolveAuthEmail(supabase, String(row.user_id))
      if (!email) {
        errors.push(`${kind}: no email for ${row.user_id}`)
        continue
      }

      const employeeName = displayNameFromProfile(profile, email)
      const weekEnd = String(row.week_end_date)
      const stamp = new Date().toISOString()

      const { error: upErr } = await supabase
        .from('employee_weekly_timesheets')
        .update({ [flagCol]: stamp })
        .eq('id', row.id)
        .is(flagCol, null)

      if (upErr) {
        errors.push(`${kind}: flag ${row.id} ${upErr.message}`)
        continue
      }

      try {
        if (kind === 1) {
          await notifyTimesheetReminder1({
            toEmail: email,
            employeeName,
            weekStart: String(row.week_start_date),
            weekEnd,
          })
        } else {
          await notifyTimesheetReminder2({
            toEmail: email,
            employeeName,
            weekStart: String(row.week_start_date),
            weekEnd,
          })
        }
        count += 1
      } catch (e) {
        await supabase
          .from('employee_weekly_timesheets')
          .update({ [flagCol]: null })
          .eq('id', row.id)
        errors.push(`${kind}: send ${row.id} ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    return count
  }

  if (isReminder1Window(now)) {
    sentR1 = await processReminder(1, currentWeek, 'reminder_1_sent_at')
  }

  if (isReminder2Day(now)) {
    sentR2 = await processReminder(2, priorWeek, 'reminder_2_sent_at')
  }

  const { data: autoCandidates, error: autoErr } = await supabase
    .from('employee_weekly_timesheets')
    .select(
      'id, user_id, week_start_date, week_end_date, total_hours, status, reminder_2_sent_at, auto_submitted_at',
    )
    .in('status', ['draft', 'rejected'])
    .not('reminder_2_sent_at', 'is', null)
    .is('auto_submitted_at', null)

  const autoSubmittedEmployees: AutoSubmittedEmployee[] = []

  if (autoErr) {
    errors.push(`auto: query ${autoErr.message}`)
  } else {
    for (const raw of autoCandidates ?? []) {
      const row = raw as TimesheetCronRow
      const r2 = row.reminder_2_sent_at
      if (!r2 || !isAutoSubmitDue(r2, now)) continue
      if (!profileById.has(String(row.user_id))) continue
      if (!hasLoggedHours(row.total_hours)) continue

      const result = await submitWeeklyTimesheet(supabase, {
        userId: String(row.user_id),
        weekStart: String(row.week_start_date),
        mode: 'system',
      })
      if (!result.ok) {
        errors.push(`auto: ${row.id} ${result.message}`)
        continue
      }

      const profile = profileById.get(String(row.user_id))!
      const email = await resolveAuthEmail(supabase, String(row.user_id))
      const employeeName = displayNameFromProfile(profile, email)
      const weekStart = String(row.week_start_date)
      const weekEnd = String(row.week_end_date)

      if (email) {
        try {
          await notifyTimesheetAutoSubmittedEmployee({
            toEmail: email,
            employeeName,
            weekStart,
            weekEnd,
          })
        } catch (e) {
          errors.push(`auto employee email ${row.id}: ${e instanceof Error ? e.message : 'failed'}`)
        }
      }

      autoSubmittedEmployees.push({ employeeDisplayName: employeeName, weekStartDate: weekStart, weekEndDate: weekEnd })
      autoSubmitted += 1
    }

    if (autoSubmittedEmployees.length > 0) {
      const mgr = await notifyTimesheetAutoSubmittedManagersBatch(supabase, autoSubmittedEmployees)
      if (mgr.status === 'failed') {
        errors.push(`auto mgr batch email: ${mgr.error}`)
      }
    }
  }

  if (isManagerDigestWindow(now)) {
    const { data: digestRow } = await supabase
      .from('timesheet_manager_digest_log')
      .select('week_start_date')
      .eq('week_start_date', priorWeek)
      .maybeSingle()

    if (!digestRow) {
      const { data: pendingSheets } = await supabase
        .from('employee_weekly_timesheets')
        .select('user_id, week_start_date, week_end_date, total_hours, status')
        .eq('week_start_date', priorWeek)
        .in('status', ['draft', 'rejected'])

      const pending: DigestPendingRow[] = []
      for (const raw of pendingSheets ?? []) {
        const r = raw as Record<string, unknown>
        const uid = String(r.user_id ?? '')
        if (!profileById.has(uid)) continue
        if (!hasLoggedHours(r.total_hours)) continue
        const profile = profileById.get(uid)!
        pending.push({
          employeeName: displayNameFromProfile(profile),
          weekStart: String(r.week_start_date),
          weekEnd: String(r.week_end_date),
          totalHours: Number(r.total_hours ?? 0),
        })
      }

      if (pending.length > 0) {
        const digest = await notifyTimesheetManagerDigest(supabase, {
          weekStart: priorWeek,
          weekEnd: String(pending[0]?.weekEnd ?? ''),
          pending,
        })
        if (digest.status === 'failed') {
          errors.push(`digest: ${digest.error}`)
        } else if (digest.status === 'sent') {
          const { error: logErr } = await supabase.from('timesheet_manager_digest_log').insert({
            week_start_date: priorWeek,
          })
          if (logErr) {
            errors.push(`digest log: ${logErr.message}`)
          } else {
            digestSent = 1
          }
        }
      } else {
        await supabase.from('timesheet_manager_digest_log').insert({
          week_start_date: priorWeek,
        })
      }
    }
  }

  return {
    ok: true,
    todayMelb,
    currentWeek,
    priorWeek,
    sentR1,
    sentR2,
    autoSubmitted,
    digestSent,
    errors,
  }
}
