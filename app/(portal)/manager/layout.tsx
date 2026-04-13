import { requireManagerOrAdminRoute } from '@/lib/auth/rbac-server'

/**
 * RBAC: only manager or admin may access /manager/* (server redirect before paint).
 */
export default async function ManagerSectionLayout({ children }: { children: React.ReactNode }) {
  await requireManagerOrAdminRoute()
  return <>{children}</>
}
