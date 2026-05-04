import { redirect } from 'next/navigation';
export default function DashboardSecurityRedirectPage() {
    redirect('/dashboard/change-password');
}
