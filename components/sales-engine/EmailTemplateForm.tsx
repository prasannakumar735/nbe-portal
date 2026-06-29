'use client'

import { SALES_EMAIL_TEMPLATE_TONES } from '@/lib/sales/constants/emailTemplate.constants'
import type { SalesCampaignTypeRecord } from '@/lib/sales/types/campaignLookup.types'
import type { EmailTemplateFormValues } from '@/hooks/useEmailTemplates'

type EmailTemplateFormProps = {
  values: EmailTemplateFormValues
  onChange: (patch: Partial<EmailTemplateFormValues>) => void
  campaignTypes: SalesCampaignTypeRecord[]
  disabled?: boolean
  submitLabel?: string
  onSubmit: () => void
  onCancel?: () => void
  error?: string | null
}

function updatePrompt(
  values: EmailTemplateFormValues,
  patch: Partial<EmailTemplateFormValues['prompt']>,
): EmailTemplateFormValues['prompt'] {
  return { ...values.prompt, ...patch }
}

export function EmailTemplateForm({
  values,
  onChange,
  campaignTypes,
  disabled = false,
  submitLabel = 'Save Template',
  onSubmit,
  onCancel,
  error,
}: EmailTemplateFormProps) {
  const p = values.prompt

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-campaign-type">
          Campaign Type
        </label>
        <select
          id="tpl-campaign-type"
          value={values.campaignTypeId}
          disabled={disabled}
          onChange={(e) => onChange({ campaignTypeId: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">Select campaign type</option>
          {campaignTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-name">
          Template Name
        </label>
        <input
          id="tpl-name"
          type="text"
          value={values.templateName}
          disabled={disabled}
          onChange={(e) => onChange({ templateName: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          placeholder="Default PVC Sales Template"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Prompt configuration</h3>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-objective">
            Objective
          </label>
          <input
            id="tpl-objective"
            type="text"
            value={p.objective}
            disabled={disabled}
            onChange={(e) => onChange({ prompt: updatePrompt(values, { objective: e.target.value }) })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            placeholder="sell pvc strip curtains"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-pain">
            Pain points (one per line)
          </label>
          <textarea
            id="tpl-pain"
            rows={4}
            value={p.painPointsText}
            disabled={disabled}
            onChange={(e) =>
              onChange({ prompt: updatePrompt(values, { painPointsText: e.target.value }) })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-cta">
            Call to action
          </label>
          <input
            id="tpl-cta"
            type="text"
            value={p.cta}
            disabled={disabled}
            onChange={(e) => onChange({ prompt: updatePrompt(values, { cta: e.target.value }) })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            placeholder="free site inspection"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-tone">
            Tone
          </label>
          <select
            id="tpl-tone"
            value={p.tone}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                prompt: updatePrompt(values, {
                  tone: e.target.value as EmailTemplateFormValues['prompt']['tone'],
                }),
              })
            }
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          >
            {SALES_EMAIL_TEMPLATE_TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-roles">
            Target roles (one per line)
          </label>
          <textarea
            id="tpl-roles"
            rows={3}
            value={p.targetRolesText}
            disabled={disabled}
            onChange={(e) =>
              onChange({ prompt: updatePrompt(values, { targetRolesText: e.target.value }) })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="tpl-avoid">
            Avoid (one per line)
          </label>
          <textarea
            id="tpl-avoid"
            rows={2}
            value={p.avoidText}
            disabled={disabled}
            onChange={(e) =>
              onChange({ prompt: updatePrompt(values, { avoidText: e.target.value }) })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isActive}
            disabled={disabled}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          Active
        </label>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  )
}
