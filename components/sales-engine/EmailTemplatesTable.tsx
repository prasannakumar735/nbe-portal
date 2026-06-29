'use client'

import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'
import { EmailTemplateStatusToggle } from '@/components/sales-engine/EmailTemplateStatusToggle'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

type EmailTemplatesTableProps = {
  rows: SalesEmailTemplate[]
  loading: boolean
  togglingId: string | null
  onView: (template: SalesEmailTemplate) => void
  onEdit: (template: SalesEmailTemplate) => void
  onToggleActive: (template: SalesEmailTemplate, isActive: boolean) => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function EmailTemplatesTable({
  rows,
  loading,
  togglingId,
  onView,
  onEdit,
  onToggleActive,
}: EmailTemplatesTableProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Templates</h2>

      {loading && rows.length === 0 ? (
        <div className="mt-4">
          <LoadingSkeleton rows={2} />
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 font-medium text-slate-700">Campaign Type</th>
              <th className="px-3 py-2 font-medium text-slate-700">Template Name</th>
              <th className="px-3 py-2 font-medium text-slate-700">Version</th>
              <th className="px-3 py-2 font-medium text-slate-700">Tone</th>
              <th className="px-3 py-2 font-medium text-slate-700">Status</th>
              <th className="px-3 py-2 font-medium text-slate-700">Created Date</th>
              <th className="px-3 py-2 font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                  No templates yet. Create one to prepare for AI email generation.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-700">{row.campaign_type_name ?? '—'}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{row.template_name}</td>
                <td className="px-3 py-2 text-slate-700">v{row.version}</td>
                <td className="px-3 py-2 capitalize text-slate-700">{row.prompt_config.tone}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.is_active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {row.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onView(row)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <EmailTemplateStatusToggle
                      isActive={row.is_active}
                      disabled={togglingId === row.id}
                      onChange={(active) => onToggleActive(row, active)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
