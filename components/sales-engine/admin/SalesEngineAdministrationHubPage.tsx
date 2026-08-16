'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function SalesEngineAdministrationHubPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/sales-engine/administration/general')
  }, [router])
  return <p className="text-sm text-slate-600">Loading administration…</p>
}
