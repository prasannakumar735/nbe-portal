import { redirect } from 'next/navigation'
import { safeInternalRedirectPath } from '@/lib/app/safeInternalRedirect'
import type { AppSearchParams } from '@/lib/app/searchParams'
import { pickSearchParam } from '@/lib/app/searchParams'

/** Shared portal login (`/login`) — preserves deep links via `next`. */
export default async function ClientLoginRedirectPage({
  searchParams,
}: {
  searchParams: Promise<AppSearchParams>
}) {
  const sp = await searchParams
  const raw = pickSearchParam(sp.redirect)
  const next = safeInternalRedirectPath(raw) ?? '/client'
  redirect(`/login?next=${encodeURIComponent(next)}`)
}
