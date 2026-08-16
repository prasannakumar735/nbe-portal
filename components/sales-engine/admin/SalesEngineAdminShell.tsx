'use client'

import Link from 'next/link'
import { SalesEngineAdminNav } from '@/components/sales-engine/admin/SalesEngineAdminNav'

type SalesEngineAdminShellProps = {
  title: string
  description?: string
  children: React.ReactNode
}

export function SalesEngineAdminShell({ title, description, children }: SalesEngineAdminShellProps) {
  return (
    <div className="w-full min-w-0 max-w-4xl space-y-6">
      <header>
        <Link
          href="/dashboard/sales-engine"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          ← Sales Engine
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Administration</h1>
        <p className="mt-1 text-sm text-slate-600">
          Runtime configuration for the Sales Engine (feature flags, pilot safe delivery, deliverability).
        </p>
      </header>

      <SalesEngineAdminNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </section>
    </div>
  )
}
