'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import { SALES_INDUSTRY_LABELS, SALES_INDUSTRY_SLUGS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS, SALES_PRODUCT_LINE_SLUGS } from '@/lib/sales/constants/productLineSlugs'
import {
  SALES_PROMPT_USE_CASE_LABELS,
  SALES_PROMPT_USE_CASE_SLUGS,
} from '@/lib/sales/constants/useCaseSlugs'
import type { SalesAiPrompt, SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'
import { EMPTY_SALES_AI_PROMPT_DEFINITION } from '@/lib/sales/types/aiPrompt.types'

type ListResponse = { prompts: SalesAiPrompt[] }

const defaultPublishDefinition = (): SalesAiPromptDefinition => ({
  ...EMPTY_SALES_AI_PROMPT_DEFINITION,
  target_audience: ['Operations manager', 'Facilities manager'],
  business_pain_points: ['Operational downtime', 'Compliance and safety requirements'],
  value_proposition: 'Practical industrial solutions with measurable operational benefit.',
  cta: 'Offer a brief site conversation to assess current setup.',
  subject_line_guidance: 'Professional, specific to operations; no hype.',
})

export function PromptLibraryPage() {
  const [prompts, setPrompts] = useState<SalesAiPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    productSlug: SALES_PRODUCT_LINE_SLUGS[0],
    industrySlug: SALES_INDUSTRY_SLUGS[0],
    useCaseSlug: SALES_PROMPT_USE_CASE_SLUGS[0],
    definition: defaultPublishDefinition(),
  })
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await salesEngineFetch<ListResponse>('/api/sales/ai-prompts')
      setPrompts(data.prompts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prompts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function publishNewVersion(activate: boolean) {
    setSaving(true)
    try {
      await salesEngineFetch('/api/sales/ai-prompts', {
        method: 'POST',
        body: JSON.stringify({
          productSlug: form.productSlug,
          industrySlug: form.industrySlug,
          useCaseSlug: form.useCaseSlug,
          definition: form.definition,
          activate,
        }),
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function activatePrompt(id: string) {
    try {
      await salesEngineFetch(`/api/sales/ai-prompts/${id}/activate`, { method: 'POST' })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activate failed')
    }
  }

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header>
        <Link
          href="/dashboard/sales-engine"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          ← Back to Sales Engine
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Prompt Library</h1>
        <p className="mt-1 text-sm text-slate-600">
          Product → industry → use case prompts with version history. Global Australian English rules
          apply to every prompt at generation time.
        </p>
        <Link
          href="/dashboard/sales-engine/templates"
          className="mt-2 inline-block text-sm text-slate-600 underline"
        >
          Legacy email templates
        </Link>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Publish prompt version</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Product
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
              value={form.productSlug}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  productSlug: e.target.value as typeof form.productSlug,
                }))
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
              value={form.industrySlug}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  industrySlug: e.target.value as typeof form.industrySlug,
                }))
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
              value={form.useCaseSlug}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  useCaseSlug: e.target.value as typeof form.useCaseSlug,
                }))
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
          Value proposition
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={2}
            value={form.definition.value_proposition}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                definition: { ...f.definition, value_proposition: e.target.value },
              }))
            }
          />
        </label>
        <label className="block text-sm">
          CTA
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.definition.cta}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                definition: { ...f.definition, cta: e.target.value },
              }))
            }
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void publishNewVersion(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Publish &amp; activate
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Versions</h2>
        {loading ? <p className="mt-2 text-sm text-slate-600">Loading…</p> : null}
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {prompts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <span className="font-medium">{p.prompt_name}</span> v{p.version}
                {p.is_active ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    active
                  </span>
                ) : null}
              </div>
              {!p.is_active ? (
                <button
                  type="button"
                  onClick={() => void activatePrompt(p.id)}
                  className="text-xs font-semibold text-indigo-700"
                >
                  Activate
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
