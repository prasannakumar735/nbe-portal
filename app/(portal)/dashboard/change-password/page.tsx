import { createServerClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm'

export default async function DashboardChangePasswordPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const email = user?.email ?? ''

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Change Password</h1>
          <p className="text-xs text-slate-500">Update your account password securely.</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <ChangePasswordForm userEmail={email} />
        </div>
      </div>
    </div>
  )
}
