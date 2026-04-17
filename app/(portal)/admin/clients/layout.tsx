import Link from 'next/link'
import { getServerUser } from '@/lib/auth/server'
import { canAccessInventoryByRole, getUserRole } from '@/lib/auth/userRole'

export default async function AdminClientsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerUser()
  if (!user?.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          Access Denied
        </div>
      </div>
    )
  }

  const role = await getUserRole(user.id)
  if (!canAccessInventoryByRole(role)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          Access Denied. Admin or manager role required.
        </div>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-slate-700 underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
