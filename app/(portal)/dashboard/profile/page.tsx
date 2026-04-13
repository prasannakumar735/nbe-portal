import { createServerClient } from '@/lib/supabase/server'
import { EditProfileForm } from '@/components/profile/EditProfileForm'

export default async function DashboardProfilePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const email = user?.email ?? ''

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Your profile</h1>
          <p className="text-xs text-slate-500">Manage your account details.</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <EditProfileForm
            email={email}
            initialFullName={profile?.full_name ?? ''}
            initialPhone={profile?.phone ?? ''}
          />
        </div>
      </div>
    </div>
  )
}
