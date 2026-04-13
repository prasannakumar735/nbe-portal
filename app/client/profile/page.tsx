import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { EditProfileForm } from '@/components/profile/EditProfileForm'

export default async function ClientProfilePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/client/login?redirect=/client/profile')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'client') {
    redirect('/dashboard')
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut()
    redirect('/client/login?redirect=/client/profile')
  }

  const email = user.email ?? ''

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Your profile</h1>
        <p className="text-xs text-slate-500">Manage your account details.</p>
      </div>

      <EditProfileForm
        email={email}
        initialFullName={profile.full_name ?? ''}
        initialPhone={profile.phone ?? ''}
      />
    </div>
  )
}
