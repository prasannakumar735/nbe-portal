import { headers } from 'next/headers'
import { LoginClient } from './LoginClient'
import { safeInternalRedirectPath } from '@/lib/app/safeInternalRedirect'
import { pickSearchParam, type AppSearchParams } from '@/lib/app/searchParams'

export default async function LoginPage({ searchParams }: { searchParams: Promise<AppSearchParams> }) {
  const sp = await searchParams
  const inactiveNotice = pickSearchParam(sp.inactive) === '1'
  const noProfileNotice = pickSearchParam(sp.error) === 'no_profile'
  const nextRedirect = safeInternalRedirectPath(pickSearchParam(sp.next))
  const h = await headers()
  const cspNonce = (typeof h?.get === 'function' ? h.get('x-nonce') : null) ?? ''

  return (
    <LoginClient
      inactiveNotice={inactiveNotice}
      noProfileNotice={noProfileNotice}
      cspNonce={cspNonce}
      nextRedirect={nextRedirect}
    />
  )
}
