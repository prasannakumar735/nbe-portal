import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import { serviceReminderNotifyIsoDate } from '@/lib/serviceReminders/dueDate'
import {
  notifyServiceDueReminderClient,
  notifyServiceDueReminderManagersBatch,
  type ServiceDueReminderItem,
} from '@/lib/notifications/portalGraphNotifications'
import { isCalendarNotificationsDisabled } from '@/lib/notifications/isCalendarNotificationsDisabled'

export async function runServiceDueRemindersJob(): Promise<Record<string, unknown>> {
  if (isCalendarNotificationsDisabled()) {
    return {
      ok: true,
      skipped: true,
      reason: 'notifications disabled (local testing)',
    }
  }

  const supabase = createServiceRoleClient()
  const todayMelb = melbourneCalendarDate(new Date())

  const { data: rows, error: qErr } = await supabase
    .from('client_service_due_reminders')
    .select(
      'id, title, notes, client_id, due_date, lead_time_days, last_service_date, ' +
        'send_manager_email, send_client_email, client_contact_email, client_contact_name, reminder_sent_at, status',
    )
    .eq('status', 'active')
    .is('reminder_sent_at', null)

  if (qErr) {
    console.error('[service-due-reminders] query error', qErr)
    return { ok: false, error: 'DB query failed' }
  }

  const dueToday = (rows ?? []).filter(raw => {
    const r = raw as unknown as Record<string, unknown>
    const due = String(r.due_date ?? '').trim()
    const lead = Number(r.lead_time_days ?? 0)
    if (!due || !Number.isFinite(lead)) return false
    const notifyOn = serviceReminderNotifyIsoDate(due, lead)
    return notifyOn === todayMelb
  })

  if (!dueToday.length) {
    return { ok: true, checked: rows?.length ?? 0, sent: 0, errors: [] }
  }

  const clientIds = [
    ...new Set(dueToday.map(r => String((r as { client_id?: string }).client_id ?? '')).filter(Boolean)),
  ]
  const clientNameById = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds)
    for (const c of clients ?? []) {
      const row = c as { id?: string; name?: string | null }
      if (row.id) clientNameById.set(String(row.id), String(row.name ?? '').trim() || 'Client')
    }
  }

  let sent = 0
  const errors: string[] = []
  const managerItems: ServiceDueReminderItem[] = []
  const flaggedIds: string[] = []

  // First pass: flag all reminders and collect client emails
  for (const raw of dueToday) {
    const row = raw as unknown as Record<string, unknown>
    const id = String(row.id ?? '')
    const clientId = String(row.client_id ?? '')
    const clientName = clientNameById.get(clientId) ?? 'Client'
    const now = new Date().toISOString()

    const { error: upErr } = await supabase
      .from('client_service_due_reminders')
      .update({ reminder_sent_at: now })
      .eq('id', id)
      .is('reminder_sent_at', null)

    if (upErr) {
      errors.push(`flag update failed for ${id}: ${upErr.message}`)
      continue
    }

    flaggedIds.push(id)

    if (row.send_manager_email !== false) {
      managerItems.push({
        clientName,
        title: String(row.title ?? 'Service due'),
        dueDate: String(row.due_date ?? ''),
        leadTimeDays: Number(row.lead_time_days ?? 0),
        lastServiceDate: row.last_service_date ? String(row.last_service_date) : null,
        notes: row.notes ? String(row.notes) : null,
      })
    }

    // Client emails are still sent individually per reminder
    if (row.send_client_email === true) {
      const em = String(row.client_contact_email ?? '').trim()
      if (em) {
        const clientRes = await notifyServiceDueReminderClient({
          toEmail: em,
          contactName: row.client_contact_name ? String(row.client_contact_name) : null,
          clientName,
          title: String(row.title ?? 'Scheduled service'),
          dueDate: String(row.due_date ?? ''),
        })
        if (clientRes.status === 'failed') {
          errors.push(`client email failed for ${id}: ${clientRes.error}`)
        }
      }
    }

    sent++
  }

  // Send one consolidated manager email for all reminders due today
  if (managerItems.length > 0) {
    const mgr = await notifyServiceDueReminderManagersBatch(supabase, managerItems)
    if (mgr.status === 'failed') {
      errors.push(`manager batch email failed: ${mgr.error}`)
      // Roll back flags for all reminders that were part of manager send
      for (const id of flaggedIds) {
        await supabase
          .from('client_service_due_reminders')
          .update({ reminder_sent_at: null })
          .eq('id', id)
      }
      sent = 0
    }
  }

  return {
    ok: true,
    checked: rows?.length ?? 0,
    dueToday: dueToday.length,
    sent,
    errors,
  }
}
