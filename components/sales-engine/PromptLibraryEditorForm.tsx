'use client'

import { SALES_INDUSTRY_LABELS, SALES_INDUSTRY_SLUGS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS, SALES_PRODUCT_LINE_SLUGS } from '@/lib/sales/constants/productLineSlugs'
import {
  SALES_PROMPT_USE_CASE_LABELS,
  SALES_PROMPT_USE_CASE_SLUGS,
} from '@/lib/sales/constants/useCaseSlugs'
import type { PromptLibraryFormState } from '@/hooks/usePromptLibrary'

type PromptLibraryEditorFormProps = {
  form: PromptLibraryFormState
  onChange: (form: PromptLibraryFormState) => void
  /** When editing an existing draft, slot slugs are locked. */
  lockSlot?: boolean
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function listToLines(items: string[]): string {
  return items.join('\n')
}

export function PromptLibraryEditorForm({
  form,
  onChange,
  lockSlot = false,
}: PromptLibraryEditorFormProps) {
  function patchDefinition(patch: Partial<PromptLibraryFormState['definition']>) {
    onChange({ ...form, definition: { ...form.definition, ...patch } })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Product
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 disabled:bg-slate-50"
            value={form.productSlug}
            disabled={lockSlot}
            onChange={(e) =>
              onChange({
                ...form,
                productSlug: e.target.value as PromptLibraryFormState['productSlug'],
              })
            }
          >
            {SALES_PRODUCT_LINE_SLUGS.map((s) => (
              <option key={s} value={s}>
                {SALES_PRODUCT_LINE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Industry
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 disabled:bg-slate-50"
            value={form.industrySlug}
            disabled={lockSlot}
            onChange={(e) =>
              onChange({
                ...form,
                industrySlug: e.target.value as PromptLibraryFormState['industrySlug'],
              })
            }
          >
            {SALES_INDUSTRY_SLUGS.map((s) => (
              <option key={s} value={s}>
                {SALES_INDUSTRY_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Use case
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 disabled:bg-slate-50"
            value={form.useCaseSlug}
            disabled={lockSlot}
            onChange={(e) =>
              onChange({
                ...form,
                useCaseSlug: e.target.value as PromptLibraryFormState['useCaseSlug'],
              })
            }
          >
            {SALES_PROMPT_USE_CASE_SLUGS.map((s) => (
              <option key={s} value={s}>
                {SALES_PROMPT_USE_CASE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        Description (optional)
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          value={form.description}
          maxLength={500}
          placeholder="Human-readable label for managers"
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Writing style
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.definition.writing_style}
            onChange={(e) => patchDefinition({ writing_style: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Tone
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.definition.tone}
            onChange={(e) => patchDefinition({ tone: e.target.value })}
          />
        </label>
      </div>

      <label className="block text-sm">
        Value proposition
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          rows={2}
          value={form.definition.value_proposition}
          onChange={(e) => patchDefinition({ value_proposition: e.target.value })}
        />
      </label>

      <label className="block text-sm">
        Call to action
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          value={form.definition.cta}
          onChange={(e) => patchDefinition({ cta: e.target.value })}
        />
      </label>

      <label className="block text-sm">
        Subject line guidance
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          rows={2}
          value={form.definition.subject_line_guidance}
          onChange={(e) => patchDefinition({ subject_line_guidance: e.target.value })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Target audience (one per line)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={3}
            value={listToLines(form.definition.target_audience)}
            onChange={(e) => patchDefinition({ target_audience: linesToList(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Business pain points (one per line)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={3}
            value={listToLines(form.definition.business_pain_points)}
            onChange={(e) =>
              patchDefinition({ business_pain_points: linesToList(e.target.value) })
            }
          />
        </label>
      </div>

      <label className="block text-sm">
        Avoid (one per line)
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          rows={2}
          value={listToLines(form.definition.avoid)}
          onChange={(e) => patchDefinition({ avoid: linesToList(e.target.value) })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Word limit
          <input
            type="number"
            min={50}
            max={500}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.definition.word_limit}
            onChange={(e) => patchDefinition({ word_limit: Number(e.target.value) || 180 })}
          />
        </label>
        <label className="text-sm">
          System prompt extension (optional)
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.definition.system_prompt_extension ?? ''}
            onChange={(e) =>
              patchDefinition({
                system_prompt_extension: e.target.value.trim() || undefined,
              })
            }
          />
        </label>
      </div>

      <label className="block text-sm">
        Custom user prompt template (optional, supports {'{{variables}}'})
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          rows={4}
          value={form.definition.user_prompt_template ?? ''}
          placeholder="Leave blank to use structured component assembly"
          onChange={(e) =>
            patchDefinition({
              user_prompt_template: e.target.value.trim() || undefined,
            })
          }
        />
      </label>
    </div>
  )
}
