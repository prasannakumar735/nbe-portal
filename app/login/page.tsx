import { LoginClient } from './LoginClient'
import { pickSearchParam, type AppSearchParams } from '@/lib/app/searchParams'

export default async function LoginPage({ searchParams }: { searchParams: Promise<AppSearchParams> }) {
  const sp = await searchParams
  const inactiveNotice = pickSearchParam(sp.inactive) === '1'
  const noProfileNotice = pickSearchParam(sp.error) === 'no_profile'

  return <LoginClient inactiveNotice={inactiveNotice} noProfileNotice={noProfileNotice} />
}
