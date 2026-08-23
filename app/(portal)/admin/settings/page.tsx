import { getServerUser } from '@/lib/auth/server'
import { getUserRole } from '@/lib/auth/userRole'
import { isAdmin } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { FEATURE_FLAG_DEFINITIONS, getFeatureFlags } from '@/lib/featureFlags'
import { FeatureFlagsClient } from './FeatureFlagsClient'

export default async function AdminSettingsPage() {
  const user = await getServerUser()
  if (!user?.id) redirect('/login')

  const role = await getUserRole(user.id)
  if (!isAdmin({ role })) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          Access Denied. Admin role required.
        </div>
      </div>
    )
  }

  const flagValues = await getFeatureFlags()

  const flags = FEATURE_FLAG_DEFINITIONS.map((def) => ({
    key: def.key,
    label: def.label,
    description: def.description,
    enabled: flagValues[def.key] ?? def.defaultEnabled,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portal Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage feature flags and navigation visibility across the portal.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Navigation Modules</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Toggle which modules appear in the sidebar for all users. Disabled modules are hidden
            from the nav but their pages still exist.
          </p>
        </div>
        <FeatureFlagsClient initialFlags={flags} />
      </section>
    </div>
  )
}
