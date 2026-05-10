import { OfficeClockClient } from '@/components/office/OfficeClockClient'
import { pickSearchParam, type AppSearchParams } from '@/lib/app/searchParams'

export const metadata = {
  title: 'Office clock | NBE Portal',
  description: 'Sign in and out at the office; hours sync to your weekly timecard.',
}

export default async function OfficeClockPage({
  searchParams,
}: {
  searchParams: Promise<AppSearchParams>
}) {
  const sp = await searchParams
  const raw = pickSearchParam(sp.site)
  const initialSiteSlug = (raw?.trim().toLowerCase() || 'hq').slice(0, 64)
  return <OfficeClockClient initialSiteSlug={initialSiteSlug} />
}
