'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PromptLibraryEditorForm } from '@/components/sales-engine/PromptLibraryEditorForm'
import { PromptPreviewMetaCard } from '@/components/sales-engine/PromptPreviewMetaCard'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import {
  defaultPromptLibraryForm,
  promptToForm,
  usePromptLibrary,
  type ActivationConflict,
  type PromptLibraryFormState,
} from '@/hooks/usePromptLibrary'
import { SALES_INDUSTRY_LABELS, SALES_INDUSTRY_SLUGS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS, SALES_PRODUCT_LINE_SLUGS } from '@/lib/sales/constants/productLineSlugs'
import {
  SALES_PROMPT_USE_CASE_LABELS,
  SALES_PROMPT_USE_CASE_SLUGS,
} from '@/lib/sales/constants/useCaseSlugs'
import { buildPromptComparisonRows } from '@/lib/sales/prompts/promptComparison'
import {
  formatPromptSlotLabel,
  formatResolvedPromptLabel,
} from '@/lib/sales/prompts/promptLabels'
import type { PromptPreviewMeta } from '@/lib/sales/prompts/promptPreviewMeta'
import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'
import type { SalesAiPrompt } from '@/lib/sales/types/aiPrompt.types'

type TabId = 'library' | 'editor' | 'preview' | 'compare'

type PreviewPayload = {
  systemPrompt: string
  userPrompt: string
  variables: PromptRenderVariables
  meta: PromptPreviewMeta
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
  { id: 'compare', label: 'Compare' },
]

async function fetchPreview(query: string): Promise<PreviewPayload> {
  const data = await salesEngineFetch<{ preview: PreviewPayload }>(
    `/api/sales/ai-prompts/preview?${query}`,
  )
  return data.preview
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatCreatedBy(createdBy: string | null): string {
  if (!createdBy) return 'System / seed'
  return createdBy.length > 12 ? `${createdBy.slice(0, 8)}…` : createdBy
}

function promptDisplayLabel(p: SalesAiPrompt): string {
  return (
    p.description?.trim() ||
    formatResolvedPromptLabel({
      productSlug: p.product_slug,
      industrySlug: p.industry_slug,
      useCaseSlug: p.use_case_slug,
      version: p.version,
    })
  )
}

export function PromptLibraryPage() {
  const lib = usePromptLibrary()
  const [tab, setTab] = useState<TabId>('library')
  const [form, setForm] = useState<PromptLibraryFormState>(() => defaultPromptLibraryForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingActivate, setPendingActivate] = useState<{
    mode: 'existing' | 'publish' | 'save-activate'
    id?: string
    conflict: ActivationConflict
  } | null>(null)

  const [previewProduct, setPreviewProduct] = useState(SALES_PRODUCT_LINE_SLUGS[0])
  const [previewIndustry, setPreviewIndustry] = useState(SALES_INDUSTRY_SLUGS[0])
  const [previewUseCase, setPreviewUseCase] = useState(SALES_PROMPT_USE_CASE_SLUGS[0])
  const [previewPromptId, setPreviewPromptId] = useState('')
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [compareLeftId, setCompareLeftId] = useState('')
  const [compareRightId, setCompareRightId] = useState('')
  const [compareLeft, setCompareLeft] = useState<SalesAiPrompt | null>(null)
  const [compareRight, setCompareRight] = useState<SalesAiPrompt | null>(null)

  const promptOptions = useMemo(
    () =>
      lib.prompts.map((p) => ({
        id: p.id,
        label: `${promptDisplayLabel(p)}${p.is_active ? ' (active)' : ''}`,
      })),
    [lib.prompts],
  )

  function openNewVersion(from?: SalesAiPrompt) {
    setEditingId(null)
    setForm(from ? promptToForm(from) : defaultPromptLibraryForm())
    lib.setValidationErrors([])
    setTab('editor')
  }

  function openEditDraft(prompt: SalesAiPrompt) {
    if (prompt.is_active) {
      lib.setError('Active prompts are immutable. Publish a new version instead.')
      return
    }
    setEditingId(prompt.id)
    setForm(promptToForm(prompt))
    lib.setValidationErrors([])
    setTab('editor')
  }

  async function handleActivateResult(
    result: Awaited<ReturnType<typeof lib.activate>>,
    pending: { mode: 'existing' | 'publish' | 'save-activate'; id?: string },
  ) {
    if (result.status === 'ok') {
      setPendingActivate(null)
      setEditingId(null)
      setForm(defaultPromptLibraryForm())
      setTab('library')
      return
    }
    if (result.status === 'conflict') {
      setPendingActivate({
        mode: 'existing',
        id: result.pendingPromptId ?? pending.id,
        conflict: result.currentActive,
      })
      await lib.refresh()
      return
    }
    if (result.status === 'validation') {
      setPendingActivate(null)
      if (result.pendingPromptId) await lib.refresh()
    }
  }

  async function requestActivate(id: string, confirmReplace = false) {
    setSaving(true)
    try {
      const result = await lib.activate(id, confirmReplace)
      await handleActivateResult(result, { mode: 'existing', id })
    } finally {
      setSaving(false)
    }
  }

  async function saveForm(activate: boolean, confirmReplace = false) {
    setSaving(true)
    lib.setError(null)
    try {
      if (editingId) {
        await lib.updateDraft(editingId, form)
        if (activate) {
          const result = await lib.activate(editingId, confirmReplace)
          await handleActivateResult(result, { mode: 'save-activate', id: editingId })
          return
        }
        setEditingId(null)
        setForm(defaultPromptLibraryForm())
        setTab('library')
        return
      }

      const result = await lib.publishVersion(form, activate, confirmReplace)
      await handleActivateResult(result, {
        mode: 'publish',
        id: result.status === 'conflict' ? result.pendingPromptId : undefined,
      })
    } catch (e) {
      lib.setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmReplaceActive() {
    if (!pendingActivate?.id) return
    await requestActivate(pendingActivate.id, true)
  }

  async function runPreview() {
    setPreviewLoading(true)
    lib.setError(null)
    try {
      const qs = previewPromptId
        ? `promptId=${encodeURIComponent(previewPromptId)}`
        : `productSlug=${previewProduct}&industrySlug=${previewIndustry}&useCaseSlug=${previewUseCase}`
      setPreview(await fetchPreview(qs))
    } catch (e) {
      lib.setError(e instanceof Error ? e.message : 'Preview failed')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  function runCompare() {
    if (!compareLeftId || !compareRightId) {
      lib.setError('Select two versions to compare.')
      return
    }
    lib.setError(null)
    setCompareLeft(lib.prompts.find((p) => p.id === compareLeftId) ?? null)
    setCompareRight(lib.prompts.find((p) => p.id === compareRightId) ?? null)
  }

  const comparisonRows =
    compareLeft && compareRight ? buildPromptComparisonRows(compareLeft, compareRight) : []

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
          Manage Product → Industry → Use Case prompts, versions, activation, and previews.
        </p>
        <Link
          href="/dashboard/sales-engine/templates"
          className="mt-2 inline-block text-sm text-slate-600 underline"
        >
          Legacy email templates
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {lib.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
          {lib.error}
        </div>
      ) : null}

      {lib.validationErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Cannot activate — incomplete prompt</p>
          <ul className="mt-1 list-disc pl-5">
            {lib.validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pendingActivate ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
          <p className="font-semibold">Replace active prompt?</p>
          <p className="mt-1">
            Another prompt is already active for this Product + Industry + Use Case:
          </p>
          <p className="mt-1 font-medium">
            {pendingActivate.conflict.label}
            {pendingActivate.conflict.description
              ? ` — ${pendingActivate.conflict.description}`
              : ''}
          </p>
          <p className="mt-1 text-indigo-800">
            Confirming will deactivate that version and activate the selected one.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void confirmReplaceActive()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm replace
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setPendingActivate(null)}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'library' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-sm">
              Product
              <select
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-2"
                value={lib.productFilter}
                onChange={(e) =>
                  lib.setProductFilter(e.target.value as typeof lib.productFilter)
                }
              >
                <option value="">All</option>
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
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-2"
                value={lib.industryFilter}
                onChange={(e) =>
                  lib.setIndustryFilter(e.target.value as typeof lib.industryFilter)
                }
              >
                <option value="">All</option>
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
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-2"
                value={lib.useCaseFilter}
                onChange={(e) =>
                  lib.setUseCaseFilter(e.target.value as typeof lib.useCaseFilter)
                }
              >
                <option value="">All</option>
                {SALES_PROMPT_USE_CASE_SLUGS.map((s) => (
                  <option key={s} value={s}>
                    {SALES_PROMPT_USE_CASE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={lib.activeOnly}
                onChange={(e) => lib.setActiveOnly(e.target.checked)}
              />
              Active only
            </label>
            <button
              type="button"
              onClick={() => openNewVersion()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              New version
            </button>
          </div>

          {lib.loading ? <p className="text-sm text-slate-600">Loading…</p> : null}

          <div className="space-y-4">
            {lib.slots.map((slot) => {
              const head = slot.versions[0]
              const slotLabel = formatPromptSlotLabel({
                productSlug: head.product_slug,
                industrySlug: head.industry_slug,
                useCaseSlug: head.use_case_slug,
              })
              return (
                <div
                  key={slot.promptName}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-slate-900">{slotLabel}</h2>
                      {slot.active?.description ? (
                        <p className="text-sm text-slate-600">{slot.active.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-sm font-semibold text-indigo-700"
                        onClick={() => {
                          setCompareLeftId(slot.versions[0]?.id ?? '')
                          setCompareRightId(slot.versions[1]?.id ?? '')
                          setCompareLeft(slot.versions[0] ?? null)
                          setCompareRight(slot.versions[1] ?? null)
                          setTab('compare')
                        }}
                      >
                        Compare versions
                      </button>
                      <button
                        type="button"
                        className="text-sm font-semibold text-indigo-700"
                        onClick={() => openNewVersion(slot.active ?? slot.versions[0])}
                      >
                        Publish new version
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Version</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium">Created By</th>
                          <th className="py-2 pr-3 font-medium">Created At</th>
                          <th className="py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {slot.versions.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 pr-3">
                              <div className="font-medium text-slate-900">v{p.version}</div>
                              <div className="text-xs text-slate-600">
                                {p.description || promptDisplayLabel(p)}
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              {p.is_active ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                                  Active
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">
                              {formatCreatedBy(p.created_by)}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">
                              {formatCreatedAt(p.created_at)}
                            </td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-slate-700"
                                  onClick={() => {
                                    setPreviewPromptId(p.id)
                                    setTab('preview')
                                  }}
                                >
                                  Preview
                                </button>
                                {!p.is_active ? (
                                  <>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-slate-700"
                                      onClick={() => openEditDraft(p)}
                                    >
                                      Edit draft
                                    </button>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-indigo-700"
                                      onClick={() => void requestActivate(p.id)}
                                    >
                                      Activate
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-amber-700"
                                    onClick={() =>
                                      void lib
                                        .deactivate(p.id)
                                        .catch((e) =>
                                          lib.setError(
                                            e instanceof Error ? e.message : String(e),
                                          ),
                                        )
                                    }
                                  >
                                    Deactivate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
            {!lib.loading && lib.slots.length === 0 ? (
              <p className="text-sm text-slate-600">
                No prompts yet. Publish a version here or run{' '}
                <code className="rounded bg-slate-100 px-1 text-xs">
                  npx tsx scripts/seed-sales-ai-prompts.ts
                </code>
                .
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'editor' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingId ? 'Edit inactive draft' : 'Publish prompt version'}
          </h2>
          <PromptLibraryEditorForm
            form={form}
            onChange={setForm}
            lockSlot={Boolean(editingId)}
          />
          <div className="flex flex-wrap gap-2">
            {editingId ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveForm(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save &amp; activate
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                >
                  Publish inactive
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveForm(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Publish &amp; activate
                </button>
              </>
            )}
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600"
              onClick={() => {
                setEditingId(null)
                setForm(defaultPromptLibraryForm())
                lib.setValidationErrors([])
                setTab('library')
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'preview' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Prompt preview</h2>
          <p className="text-sm text-slate-600">
            Preview uses placeholder values (e.g. Unknown Company) when fields are missing. Generation
            does not use these placeholders.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm sm:col-span-2">
              Specific version (optional)
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
                value={previewPromptId}
                onChange={(e) => setPreviewPromptId(e.target.value)}
              >
                <option value="">Active slot (product / industry / use case)</option>
                {promptOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {!previewPromptId ? (
              <>
                <label className="text-sm">
                  Product
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
                    value={previewProduct}
                    onChange={(e) =>
                      setPreviewProduct(e.target.value as typeof previewProduct)
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
                    value={previewIndustry}
                    onChange={(e) =>
                      setPreviewIndustry(e.target.value as typeof previewIndustry)
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
                    value={previewUseCase}
                    onChange={(e) =>
                      setPreviewUseCase(e.target.value as typeof previewUseCase)
                    }
                  >
                    {SALES_PROMPT_USE_CASE_SLUGS.map((s) => (
                      <option key={s} value={s}>
                        {SALES_PROMPT_USE_CASE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>
          <button
            type="button"
            disabled={previewLoading}
            onClick={() => void runPreview()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {previewLoading ? 'Loading…' : 'Run preview'}
          </button>
          {preview ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <PromptPreviewMetaCard meta={preview.meta} />
              <div>
                <h3 className="font-semibold text-slate-900">Variables</h3>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs">
                  {JSON.stringify(preview.variables, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">System prompt</h3>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs">
                  {preview.systemPrompt}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">User prompt</h3>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs">
                  {preview.userPrompt}
                </pre>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'compare' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Compare versions</h2>
          <p className="text-sm text-slate-600">
            Side-by-side view of tone, pain points, value proposition, CTA, and related fields.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Version 1
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
                value={compareLeftId}
                onChange={(e) => setCompareLeftId(e.target.value)}
              >
                <option value="">Select…</option>
                {promptOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Version 2
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
                value={compareRightId}
                onChange={(e) => setCompareRightId(e.target.value)}
              >
                <option value="">Select…</option>
                {promptOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={runCompare}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Compare
          </button>

          {compareLeft && compareRight ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">
                      Version {compareLeft.version}
                      <div className="normal-case font-normal text-slate-600">
                        {promptDisplayLabel(compareLeft)}
                      </div>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      Version {compareRight.version}
                      <div className="normal-case font-normal text-slate-600">
                        {promptDisplayLabel(compareRight)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr
                      key={row.key}
                      className={
                        row.changed
                          ? 'border-t border-amber-100 bg-amber-50/60'
                          : 'border-t border-slate-100'
                      }
                    >
                      <td className="px-3 py-2 align-top font-semibold text-slate-800">
                        {row.label}
                        {row.changed ? (
                          <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                            Changed
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-pre-wrap text-slate-700">
                        {row.left}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-pre-wrap text-slate-700">
                        {row.right}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-800">Version {compareLeft.version} history</p>
                  <p>Created By: {formatCreatedBy(compareLeft.created_by)}</p>
                  <p>Created At: {formatCreatedAt(compareLeft.created_at)}</p>
                  <p>Status: {compareLeft.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Version {compareRight.version} history</p>
                  <p>Created By: {formatCreatedBy(compareRight.created_by)}</p>
                  <p>Created At: {formatCreatedAt(compareRight.created_at)}</p>
                  <p>Status: {compareRight.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
