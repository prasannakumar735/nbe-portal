import { LoginClient } from './LoginClient'

type Search = {
  inactive?: string | string[]
  error?: string | string[]
}

function first(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined
  return Array.isArray(v) ? v[0] : v
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const inactiveNotice = first(sp.inactive) === '1'
  const noProfileNotice = first(sp.error) === 'no_profile'

  return <LoginClient inactiveNotice={inactiveNotice} noProfileNotice={noProfileNotice} />
}
