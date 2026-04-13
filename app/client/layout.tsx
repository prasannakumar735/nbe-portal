import type { ReactNode } from 'react'

/**
 * Minimal shell for `/app/client/*` — no `(portal)` sidebar or staff modules.
 * Auth: public marketing pages (`/client` home); token viewers use `/report/view/[token]`;
 * logged-in client users use `/client/login` + role `client` (see middleware redirect from staff routes).
 */
export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">NBE Australia</span>
          <span className="text-xs text-slate-500">Client report access</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
