import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm'

export default async function ClientChangePasswordPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/client/login?redirect=/client/change-password')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'client') {
    redirect('/dashboard')
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut()
    redirect('/client/login?redirect=/client/change-password')
  }

  const email = user.email ?? ''

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Change password</h1>
        <p className="text-xs text-slate-500">Update your account password securely.</p>
      </div>

      <ChangePasswordForm userEmail={email} signInRedirect="/client/login" />
    </div>
  )
}
