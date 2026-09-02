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
  },
] as const

export type NotificationSettingKey = (typeof NOTIFICATION_SETTING_DEFINITIONS)[number]['key']

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

  const settings = NOTIFICATION_SETTING_DEFINITIONS.map(def => ({
    ...def,
    value: dbMap[def.key] !== undefined ? parseInt(String(dbMap[def.key]), 10) : def.defaultValue,
  }))

  return ok(settings)
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi(request)
  if (!auth.ok) return auth.response

  let body: { key?: string; value?: number }
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body')
  }

  const { key, value } = body
  if (typeof key !== 'string' || !key.trim()) return fail('key is required')

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
