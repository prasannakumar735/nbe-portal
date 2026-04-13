import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
/** PDF embed is client-only (`components/report/PdfViewer.tsx`, dynamic ssr:false) — see MergedReportViewer. */
import { MergedReportViewer } from '@/components/merged-report/MergedReportViewer'
import { ClientReportMessage } from '@/components/merged-report/ClientReportMessage'
import {
  checkMergedReportClientGate,
  fetchMergedReportByAccessToken,
} from '@/lib/merged-reports/serverAccess'
import { recordMergedReportView } from '@/lib/merged-reports/recordView'

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function ReportViewPage({ params }: PageProps) {
  const { token } = await params
  const accessToken = decodeURIComponent(String(token ?? '').trim())
  if (!accessToken) {
    return (
      <ClientReportMessage
        title="Invalid link"
        description="This report link is not valid. Please use the link from your email or contact NBE support."
      />
    )
  }

  const row = await fetchMergedReportByAccessToken(accessToken)
  if (!row) {
    return (
      <ClientReportMessage
        title="Report unavailable"
        description="This link is not valid or the report is no longer available."
      />
    )
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const viewPath = `/report/view/${encodeURIComponent(accessToken)}`
  if (!user) {
    redirect(`/client/login?redirect=${encodeURIComponent(viewPath)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, client_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'client') {
    return (
      <ClientReportMessage
        title="Access restricted"
        description="This secure link is only for client accounts. Please sign in with your client portal credentials."
      />
    )
  }

  const userClientId = profile.client_id ? String(profile.client_id) : null
  const gate = checkMergedReportClientGate(row, userClientId)

  if (gate === 'expired') {
    return (
      <ClientReportMessage
        title="Link expired"
        description="This report link has expired."
      />
    )
  }

  if (gate === 'wrong_client' || gate === 'no_client_profile') {
    return (
      <ClientReportMessage
        title="Access denied"
        description="You do not have access to this report. If you believe this is an error, contact NBE support."
      />
    )
  }

  if (!row.pdf_storage_path) {
    return (
      <ClientReportMessage
        title="Report not ready"
        description="Unable to load report. Please contact support."
      />
    )
  }

  await recordMergedReportView(row.id)

  const pdfSrc = `/api/client/merged-report/${encodeURIComponent(accessToken)}/file`
  const preparedName = (row.client_name && row.client_name.trim()) || 'your facility'

  return (
    <MergedReportViewer pdfSrc={pdfSrc} preparedFor={preparedName} title="Maintenance Inspection Report Summary" />
  )
}
