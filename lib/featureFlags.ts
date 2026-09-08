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
  // ── Portal modules (all users) ──────────────────────────────────────────────
  {
    key: 'nav_quote',
    label: 'Quote',
    description: 'Show Quote in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_timecards',
    label: 'Timecards',
    description: 'Show Timecards in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_maintenance',
    label: 'Maintenance Service',
    description: 'Show Maintenance Service in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_qr_codes',
    label: 'QR Codes',
    description: 'Show QR Codes in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_reimbursement',
    label: 'Reimbursement',
    description: 'Show Reimbursement Claims in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_pvc_calculator',
    label: 'PVC Strip Calculator',
    description: 'Show PVC Strip Calculator in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_calendar',
    label: 'Shared Calendar',
    description: 'Show Shared Calendar in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_job_card',
    label: 'Job Card & Client GPS',
    description: 'Show Job Card & Client GPS in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_knowledge',
    label: 'Knowledge Share',
    description: 'Show Knowledge Share in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_reports',
    label: 'Reports',
    description: 'Show Reports in the sidebar navigation',
    defaultEnabled: true,
  },
  {
    key: 'nav_new_quotes',
    label: 'New Quotes',
    description: 'Show New Quotes in the sidebar navigation',
    defaultEnabled: true,
  },
  // ── Access control ──────────────────────────────────────────────────────────
  {
    key: 'public_maintenance_reports',
    label: 'Public Maintenance Report Access',
    description:
      'When ON: anyone with a report QR link can view and download the PDF without logging in. When OFF: login is required to access any report link.',
    defaultEnabled: false,
  },
  // ── Admin/manager-only modules ──────────────────────────────────────────────
  {
    key: 'nav_sales_engine',
    label: 'Sales Engine',
    description: 'Show Sales Engine in the sidebar navigation (admin/manager only)',
    defaultEnabled: true,
  },
  {
    key: 'nav_service_reminders',
    label: 'Service Reminders',
    description: 'Show Service Reminders in the sidebar navigation (admin/manager only)',
    defaultEnabled: true,
  },
  {
    key: 'nav_inventory',
    label: 'Inventory',
    description: 'Show Inventory in the sidebar navigation (admin/manager only)',
    defaultEnabled: true,
  },
]

/** Fetches a single feature flag value. Falls back to the definition's default. */
export async function getSingleFeatureFlag(key: string): Promise<boolean> {
  const flags = await getFeatureFlags()
  const def = FEATURE_FLAG_DEFINITIONS.find((f) => f.key === key)
  return flags[key] ?? def?.defaultEnabled ?? false
}

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
