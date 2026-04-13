import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ token: string }>
}

/** Legacy URL; canonical viewer is `/report/view/[token]`. */
export default async function ClientMergedReportPage({ params }: PageProps) {
  const { token } = await params
  const accessToken = String(token ?? '').trim()
  if (!accessToken) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-800">
        Invalid link.
      </div>
    )
  }
  redirect(`/report/view/${encodeURIComponent(accessToken)}`)
}
