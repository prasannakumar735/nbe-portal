import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { ClientPortalShell } from '@/components/client/ClientPortalShell'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function ReportViewLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return children
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (profile?.role === 'client') {
    return <ClientPortalShell>{children}</ClientPortalShell>
  }

  return children
}
