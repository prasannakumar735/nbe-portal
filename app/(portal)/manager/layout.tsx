import { requireManagerOrAdminRoute } from '@/lib/auth/rbac-server';
export default async function ManagerSectionLayout({ children }: {
    children: React.ReactNode;
}) {
    await requireManagerOrAdminRoute();
    return <>{children}</>;
}
