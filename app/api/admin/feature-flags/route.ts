import { NextRequest } from 'next/server'
import { requireAdminApi, ok, fail } from '@/app/api/admin/_utils'
import { FEATURE_FLAG_DEFINITIONS } from '@/lib/featureFlags'

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('portal_feature_flags')
    .select('key, enabled, label, description')

  if (error) return fail('Failed to fetch feature flags', 500)

  // Merge DB rows with definitions (so we always return all known flags)
  const dbMap: Record<string, { enabled: boolean; label: string; description: string }> =
    Object.fromEntries((data ?? []).map((r: { key: string; enabled: boolean; label: string; description: string }) => [r.key, r]))

  const flags = FEATURE_FLAG_DEFINITIONS.map((def) => ({
    key: def.key,
    label: dbMap[def.key]?.label ?? def.label,
    description: dbMap[def.key]?.description ?? def.description,
    enabled: dbMap[def.key]?.enabled ?? def.defaultEnabled,
  }))

  return ok(flags)
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi(request)
  if (!auth.ok) return auth.response

  let body: { key?: string; enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body')
  }

  const { key, enabled } = body
  if (typeof key !== 'string' || key.trim() === '') return fail('key is required')
  if (typeof enabled !== 'boolean') return fail('enabled must be a boolean')

  const def = FEATURE_FLAG_DEFINITIONS.find((d) => d.key === key)
  if (!def) return fail('Unknown feature flag key', 400)

  const { error } = await auth.supabase
    .from('portal_feature_flags')
    .upsert(
      { key, enabled, label: def.label, description: def.description },
      { onConflict: 'key' },
    )

  if (error) return fail('Failed to update feature flag', 500)

  return ok({ key, enabled })
}
