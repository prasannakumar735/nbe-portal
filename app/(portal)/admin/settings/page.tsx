import { getServerUser } from '@/lib/auth/server'
import { getUserRole } from '@/lib/auth/userRole'
import { isAdmin } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { FEATURE_FLAG_DEFINITIONS, getFeatureFlags } from '@/lib/featureFlags'
import { FeatureFlagsClient } from './FeatureFlagsClient'
import { NotificationSettingsClient } from './NotificationSettingsClient'

type Tab = 'feature_flags' | 'notifications'

type SearchParams = Promise<{ tab?: string }>

export default async function AdminSettingsPage({ searchParams }: { searchParams: SearchParams }) {
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

  const { tab: tabParam } = await searchParams
  const activeTab: Tab = tabParam === 'notifications' ? 'notifications' : 'feature_flags'

  const flagValues = await getFeatureFlags()
  const flags = FEATURE_FLAG_DEFINITIONS.map((def) => ({
    key: def.key,
    label: def.label,
    description: def.description,
    enabled: flagValues[def.key] ?? def.defaultEnabled,
  }))

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'feature_flags', label: 'Feature Flags' },
    { key: 'notifications', label: 'Notification Settings' },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portal Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage feature flags and notification behaviour across the portal.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map(t => (
          <a
            key={t.key}
            href={`/admin/settings${t.key === 'feature_flags' ? '' : `?tab=${t.key}`}`}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Feature Flags tab */}
      {activeTab === 'feature_flags' && (
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
      )}

      {/* Notification Settings tab */}
      {activeTab === 'notifications' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Notification Settings</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Configure timing and thresholds for automated alerts sent by the portal cron jobs.
            </p>
          </div>
          <NotificationSettingsClient />
        </section>
      )}
    </div>
  )
}
