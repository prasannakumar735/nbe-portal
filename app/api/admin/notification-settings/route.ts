import { NextRequest } from 'next/server'
import { requireAdminApi, ok, fail } from '@/app/api/admin/_utils'

export const NOTIFICATION_SETTING_DEFINITIONS = [
  {
    key: 'door_service_lead_time_days',
    label: 'Door service alert lead time (days)',
    description:
      'How many days before a door\'s service due date to email managers. Applies to the automated door service alert cron job.',
    defaultValue: 15,
    min: 1,
    max: 90,
    unit: 'days',
    type: 'numeric' as const,
  },
  {
    key: 'door_service_interval_months',
    label: 'Door service interval (months)',
    description:
      'How many months between door services. A door is considered overdue once this period has passed since its last inspection (or install date if never inspected).',
    defaultValue: 6,
    min: 1,
    max: 24,
    unit: 'months',
    type: 'numeric' as const,
  },
] as const

export const NOTIFICATION_TOGGLE_DEFINITIONS = [
  {
    key: 'reminder_notifications_enabled',
    label: 'Enable reminder notifications',
    description: 'When disabled, the daily cron job will not send any automated door service reminder emails.',
    defaultValue: true,
    type: 'toggle' as const,
  },
] as const

export const NOTIFICATION_EMAIL_LIST_DEFINITIONS = [
  {
    key: 'reminder_notification_recipients',
    label: 'Notification recipients',
    description: 'Custom email addresses to receive door service reminders. Only @nbeaustralia.com.au addresses are accepted. Leave empty to notify all portal managers and admins automatically.',
    defaultValue: '',
    type: 'email_list' as const,
  },
] as const

const ALL_TOGGLE_KEYS = NOTIFICATION_TOGGLE_DEFINITIONS.map(d => d.key)
const ALL_EMAIL_LIST_KEYS = NOTIFICATION_EMAIL_LIST_DEFINITIONS.map(d => d.key)
const ALL_NUMERIC_KEYS = NOTIFICATION_SETTING_DEFINITIONS.map(d => d.key)

export type NotificationSettingKey =
  | (typeof NOTIFICATION_SETTING_DEFINITIONS)[number]['key']
  | (typeof NOTIFICATION_TOGGLE_DEFINITIONS)[number]['key']
  | (typeof NOTIFICATION_EMAIL_LIST_DEFINITIONS)[number]['key']

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('portal_notification_settings')
    .select('key, value')

  if (error) return fail('Failed to fetch notification settings', 500)

  const dbMap = Object.fromEntries(
    (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  )

  const numericSettings = NOTIFICATION_SETTING_DEFINITIONS.map(def => ({
    ...def,
    value: dbMap[def.key] !== undefined ? parseInt(String(dbMap[def.key]), 10) : def.defaultValue,
  }))

  const toggleSettings = NOTIFICATION_TOGGLE_DEFINITIONS.map(def => ({
    ...def,
    value: dbMap[def.key] !== undefined ? dbMap[def.key] !== 'false' : def.defaultValue,
  }))

  const emailListSettings = NOTIFICATION_EMAIL_LIST_DEFINITIONS.map(def => ({
    ...def,
    value: dbMap[def.key] !== undefined ? String(dbMap[def.key]) : def.defaultValue,
  }))

  return ok([...toggleSettings, ...emailListSettings, ...numericSettings])
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi(request)
  if (!auth.ok) return auth.response

  let body: { key?: string; value?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body')
  }

  const { key, value } = body
  if (typeof key !== 'string' || !key.trim()) return fail('key is required')

  // ── Toggle setting ──────────────────────────────────────────────────────────
  if ((ALL_TOGGLE_KEYS as readonly string[]).includes(key)) {
    if (typeof value !== 'boolean') return fail('Value must be a boolean', 400)
    const def = NOTIFICATION_TOGGLE_DEFINITIONS.find(d => d.key === key)!
    const { error } = await auth.supabase
      .from('portal_notification_settings')
      .upsert(
        { key, value: String(value), description: def.description, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    if (error) return fail('Failed to update setting', 500)
    return ok({ key, value })
  }

  // ── Email list setting ──────────────────────────────────────────────────────
  if ((ALL_EMAIL_LIST_KEYS as readonly string[]).includes(key)) {
    if (typeof value !== 'string') return fail('Value must be a string', 400)
    const emails = value.split(',').map(e => e.trim()).filter(Boolean)
    const invalid = emails.filter(e => !e.endsWith('@nbeaustralia.com.au'))
    if (invalid.length > 0) {
      return fail(`Only @nbeaustralia.com.au addresses are allowed: ${invalid.join(', ')}`, 400)
    }
    const def = NOTIFICATION_EMAIL_LIST_DEFINITIONS.find(d => d.key === key)!
    const normalized = emails.join(',')
    const { error } = await auth.supabase
      .from('portal_notification_settings')
      .upsert(
        { key, value: normalized, description: def.description, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    if (error) return fail('Failed to update setting', 500)
    return ok({ key, value: normalized })
  }

  // ── Numeric setting ─────────────────────────────────────────────────────────
  if ((ALL_NUMERIC_KEYS as readonly string[]).includes(key)) {
    const def = NOTIFICATION_SETTING_DEFINITIONS.find(d => d.key === key)
    if (!def) return fail('Unknown notification setting key', 400)
    if (typeof value !== 'number' || !Number.isFinite(value) || value < def.min || value > def.max) {
      return fail(`Value must be a number between ${def.min} and ${def.max}`, 400)
    }
    const { error } = await auth.supabase
      .from('portal_notification_settings')
      .upsert(
        { key, value: String(value), description: def.description, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    if (error) return fail('Failed to update setting', 500)
    return ok({ key, value })
  }

  return fail('Unknown notification setting key', 400)
}
