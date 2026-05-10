import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { MergedReportViewer } from '@/components/merged-report/MergedReportViewer';
import { ClientReportMessage } from '@/components/merged-report/ClientReportMessage';
import { checkMergedReportClientGate, fetchMergedReportByAccessToken, } from '@/lib/merged-reports/serverAccess';
import { recordMergedReportView } from '@/lib/merged-reports/recordView';
import { checkMaintenanceReportClientGate, fetchMaintenanceReportByShareToken, } from '@/lib/maintenance-reports/clientAccess';
import { resolveValidatedPortalLocationId } from '@/lib/client-portal/getClientPortalSession';
import { safeProfilePortalLocationId } from '@/lib/client-portal/safeProfilePortalLocationId';
import { mergedReportAllowedForClientPortal } from '@/lib/client-portal/clientMaintenancePortal';
type PageProps = {
    params: Promise<{
        token: string;
    }>;
};
export default async function ReportViewPage({ params }: PageProps) {
    const { token } = await params;
    const accessToken = decodeURIComponent(String(token ?? '').trim());
    if (!accessToken) {
        return (<ClientReportMessage title="Invalid link" description="This report link is not valid. Please use the link from your email or contact NBE support."/>);
    }
    const supabase = await createServerClient();
    const { data: { user }, } = await supabase.auth.getUser();
    const viewPath = `/report/view/${encodeURIComponent(accessToken)}`;
    if (!user) {
        redirect(`/login?next=${encodeURIComponent(viewPath)}`);
    }
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, client_id')
        .eq('id', user.id)
        .maybeSingle();
    if (profile?.role !== 'client') {
        return (<ClientReportMessage title="Access restricted" description="This secure link is only for client accounts. Please sign in with your client portal credentials."/>);
    }
    const userClientId = profile.client_id ? String(profile.client_id) : null;
    const portalRaw = await safeProfilePortalLocationId(user.id);
    const portalLocationId = userClientId ? await resolveValidatedPortalLocationId(userClientId, portalRaw) : null;
    const mergedRow = await fetchMergedReportByAccessToken(accessToken);
    if (mergedRow) {
        const gate = checkMergedReportClientGate(mergedRow, userClientId);
        if (gate === 'expired') {
            return (<ClientReportMessage title="Link expired" description="This report link has expired."/>);
        }
        if (gate === 'wrong_client' || gate === 'no_client_profile') {
            return (<ClientReportMessage title="Access denied" description="You do not have access to this report. If you believe this is an error, contact NBE support."/>);
        }
        if (portalLocationId && userClientId) {
            const locOk = await mergedReportAllowedForClientPortal(mergedRow.id, userClientId, portalLocationId);
            if (!locOk) {
                return (<ClientReportMessage title="Access denied" description="This summary includes sites outside your portal access. Contact NBE support if you need the full organisation report."/>);
            }
        }
        if (!mergedRow.pdf_storage_path) {
            return (<ClientReportMessage title="Report not ready" description="Unable to load report. Please contact support."/>);
        }
        await recordMergedReportView(mergedRow.id);
        const pdfSrc = `/api/client/merged-report/${encodeURIComponent(accessToken)}/file`;
        const preparedName = (mergedRow.client_name && mergedRow.client_name.trim()) || 'your facility';
        return (<MergedReportViewer pdfSrc={pdfSrc} preparedFor={preparedName} title="Maintenance Inspection Report Summary"/>);
    }
    const singleRow = await fetchMaintenanceReportByShareToken(accessToken);
    if (!singleRow) {
        return (<ClientReportMessage title="Report unavailable" description="This link is not valid or the report is no longer available."/>);
    }
    const singleGate = checkMaintenanceReportClientGate(singleRow, userClientId, portalLocationId);
    if (singleGate === 'not_approved') {
        return (<ClientReportMessage title="Report not shared" description="This report is not yet approved for client viewing."/>);
    }
    if (singleGate === 'no_pdf') {
        return (<ClientReportMessage title="Report not ready" description="Unable to load report PDF. Please contact support."/>);
    }
    if (singleGate === 'wrong_client' || singleGate === 'no_client_profile') {
        return (<ClientReportMessage title="Access denied" description="You do not have access to this report. If you believe this is an error, contact NBE support."/>);
    }
    const pdfSrc = `/api/client/maintenance-report/${encodeURIComponent(accessToken)}/file`;
    const preparedName = (singleRow.client_name && singleRow.client_name.trim()) || 'your facility';
    return (<MergedReportViewer pdfSrc={pdfSrc} preparedFor={preparedName} title="Maintenance Inspection Report"/>);
}
