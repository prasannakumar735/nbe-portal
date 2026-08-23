import { RouteGuard } from './components/DashboardGuard';
import { LayoutWrapper } from './components/LayoutWrapper';
import { getServerUser } from '@/lib/auth/server';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getFeatureFlags } from '@/lib/featureFlags';
export default async function PortalLayout({ children, }: {
    children: React.ReactNode;
}) {
    const user = await getServerUser();
    if (!user) {
        redirect('/login');
    }
    const [supabase, featureFlags] = await Promise.all([
        createServerClient(),
        getFeatureFlags(),
    ]);
    const { data: portalProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (portalProfile?.role === 'client') {
        redirect('/client');
    }
    const portalRole = portalProfile?.role ?? null;
    const portalManagerOrAdmin = portalRole === 'admin' || portalRole === 'manager';
    return (<RouteGuard>
      <LayoutWrapper user={user} portalRole={portalRole} portalManagerOrAdmin={portalManagerOrAdmin} featureFlags={featureFlags}>
        {children}
      </LayoutWrapper>
    </RouteGuard>);
}
