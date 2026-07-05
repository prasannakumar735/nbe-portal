'use client'

import Link from 'next/link'
import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'

type EmailTemplateSummaryProps = {
  template: SalesEmailTemplate | null
  loading?: boolean
}

export function EmailTemplateSummary({ template, loading }: EmailTemplateSummaryProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Prompt &amp; template</h2>
          <p className="mt-1 text-sm text-slate-600">
            AI generation uses the active Prompt Library entry (product, industry, use case). Legacy
            templates remain for reference.
          </p>
        <Link
          href="/dashboard/sales-engine/prompt-library"
          className="mt-2 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          Manage Prompt Library →
        </Link>
        </div>
        <Link
          href="/dashboard/sales-engine/templates"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          Manage templates →
        </Link>
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : template ? (
        <p className="mt-3 text-sm font-medium text-slate-900">{template.template_name}</p>
      ) : (
        <p className="mt-3 text-sm text-red-600">
          No active template. Activate one before generating emails.
        </p>
      )}
    </section>
  )
}
