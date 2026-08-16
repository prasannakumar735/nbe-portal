'use client'

import type { SalesCampaignTypeRecord } from '@/lib/sales/types/campaignLookup.types'
import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'
import { EmailTemplateForm } from '@/components/sales-engine/EmailTemplateForm'
import type { EmailTemplateFormValues } from '@/hooks/useEmailTemplates'

type EmailTemplateEditorMode = 'view' | 'edit'

type EmailTemplateEditorProps = {
  open: boolean
  mode: EmailTemplateEditorMode
  template: SalesEmailTemplate | null
  values: EmailTemplateFormValues
  campaignTypes: SalesCampaignTypeRecord[]
  onChange: (patch: Partial<EmailTemplateFormValues>) => void
  saving: boolean
  formError: string | null
  onClose: () => void
  onSwitchToEdit: () => void
  onSave: () => void
}

export function EmailTemplateEditor({
  open,
  mode,
  template,
  values,
  campaignTypes,
  onChange,
  saving,
  formError,
  onClose,
  onSwitchToEdit,
  onSave,
}: EmailTemplateEditorProps) {
  if (!open || !template) return null

  const readOnly = mode === 'view'
  const cfg = template.prompt_config

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-template-editor-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="email-template-editor-title" className="text-lg font-semibold text-slate-900">
              {readOnly ? 'View Template' : 'Edit Template'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {template.template_name} · v{template.version}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          {readOnly ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-slate-700">Campaign Type</p>
                <p className="mt-1 text-slate-900">
                  {template.campaign_type_name ??
                    campaignTypes.find((c) => c.id === values.campaignTypeId)?.name ??
                    '—'}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Objective</p>
                <p className="mt-1 text-slate-900">{cfg.objective}</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Pain points</p>
                <ul className="mt-1 list-inside list-disc text-slate-900">
                  {cfg.pain_points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">CTA</p>
                <p className="mt-1 text-slate-900">{cfg.cta}</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tone</p>
                <p className="mt-1 capitalize text-slate-900">{cfg.tone}</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Target roles</p>
                <ul className="mt-1 list-inside list-disc text-slate-900">
                  {cfg.target_roles.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Avoid</p>
                <ul className="mt-1 list-inside list-disc text-slate-900">
                  {cfg.avoid.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Status</p>
                <p className="mt-1 text-slate-900">{values.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              <button
                type="button"
                onClick={onSwitchToEdit}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Edit
              </button>
            </div>
          ) : (
            <EmailTemplateForm
              values={values}
              onChange={onChange}
              campaignTypes={campaignTypes}
              disabled={saving}
              submitLabel={saving ? 'Saving…' : 'Save Changes'}
              onSubmit={onSave}
              onCancel={onClose}
              error={formError}
            />
          )}
        </div>
      </div>
    </div>
  )
}
