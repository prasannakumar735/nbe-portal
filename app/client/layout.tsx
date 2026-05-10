import type { ReactNode } from 'react'
import { ClientPortalShell } from '@/components/client/ClientPortalShell'

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return <ClientPortalShell>{children}</ClientPortalShell>
}
