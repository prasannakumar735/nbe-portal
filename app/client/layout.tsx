import type { ReactNode } from 'react'
import { ClientPortalHeader } from '@/components/client/ClientPortalHeader'

/**
 * Minimal shell for `/app/client/*` — no `(portal)` sidebar or staff modules.
 * Auth: public marketing pages (`/client` home); token viewers use `/report/view/[token]`;
 * logged-in client users use `/client/login` + role `client` (see middleware redirect from staff routes).
 */
export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <ClientPortalHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
