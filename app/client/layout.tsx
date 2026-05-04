import type { ReactNode } from 'react';
import { ClientPortalHeader } from '@/components/client/ClientPortalHeader';
export default function ClientPortalLayout({ children }: {
    children: ReactNode;
}) {
    return (<div className="min-h-screen bg-slate-100">
      <ClientPortalHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>);
}
