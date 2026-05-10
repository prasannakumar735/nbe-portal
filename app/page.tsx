'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthScreenLogo } from '@/components/common/AuthScreenLogo'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/login')
  }, [router])
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 py-12">
      <AuthScreenLogo />
      <p className="text-sm text-slate-600">Opening login…</p>
    </div>
  )
}
