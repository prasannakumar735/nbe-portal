import { RouteGuard } from './components/DashboardGuard';
import { LayoutWrapper } from './components/LayoutWrapper';
import { getServerUser } from '@/lib/auth/server';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
export default async function PortalLayout({ children, }: {
    children: React.ReactNode;
}) {
    const user = await getServerUser();
    if (!user) {
        redirect('/login');
    }
    const supabase = await createServerClient();
    const { data: portalProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (portalProfile?.role === 'client') {
        redirect('/client');
    }
    return (<RouteGuard>
      <LayoutWrapper user={user}>
        {children}
      </LayoutWrapper>
    </RouteGuard>);
}
