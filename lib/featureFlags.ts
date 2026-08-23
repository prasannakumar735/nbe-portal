import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export type FeatureFlag = {
  key: string
  enabled: boolean
  label: string
  description: string
}

export type FeatureFlags = Record<string, boolean>

export type FeatureFlagDefinition = Omit<FeatureFlag, 'enabled'> & { defaultEnabled: boolean }

/**
 * All nav-controllable feature flags with their defaults.
 * If a flag is missing from the DB it falls back to `defaultEnabled`.
 */
export const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  {
    key: 'nav_knowledge',
    label: 'Knowledge Share',
    description: 'Show Knowledge Share in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_reimbursement',
    label: 'Reimbursement Claims',
    description: 'Show Reimbursement Claims in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_qr_codes',
    label: 'QR Codes',
    description: 'Show QR Codes in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_calendar',
    label: 'Shared Calendar',
    description: 'Show Shared Calendar in the sidebar navigation',
    defaultEnabled: true,
  },
]

/** Fetches all feature flags from the DB. Missing keys fall back to their default. */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const defaults: FeatureFlags = Object.fromEntries(
    FEATURE_FLAG_DEFINITIONS.map((f) => [f.key, f.defaultEnabled]),
  )

  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('portal_feature_flags')
      .select('key, enabled')

    if (error || !data) return defaults

    const result = { ...defaults }
    for (const row of data) {
      if (typeof row.key === 'string') {
        result[row.key] = Boolean(row.enabled)
      }
    }
    return result
  } catch {
    return defaults
  }
}
