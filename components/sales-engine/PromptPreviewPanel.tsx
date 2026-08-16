'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import { PromptPreviewMetaCard } from '@/components/sales-engine/PromptPreviewMetaCard'
import type { PromptPreviewMeta } from '@/lib/sales/prompts/promptPreviewMeta'
import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'

type PreviewResponse = {
  preview: {
    systemPrompt: string
    userPrompt: string
    promptName: string
    promptVersion: number
    promptLibraryId: string
    promptDescription: string | null
    variables: PromptRenderVariables
    product_slug: string
    industry_slug: string
    use_case_slug: string
    resolution_path: string[]
    meta: PromptPreviewMeta
  }
}

type PromptPreviewPanelProps = {
  campaignId?: string
  promptId?: string
  productSlug?: string
  industrySlug?: string
  useCaseSlug?: string
  title?: string
  autoLoad?: boolean
}

function buildPreviewQuery(props: PromptPreviewPanelProps): string {
  const params = new URLSearchParams()
  if (props.promptId) params.set('promptId', props.promptId)
  if (props.campaignId) params.set('campaignId', props.campaignId)
  if (props.productSlug) params.set('productSlug', props.productSlug)
  if (props.industrySlug) params.set('industrySlug', props.industrySlug)
  if (props.useCaseSlug) params.set('useCaseSlug', props.useCaseSlug)
  return params.toString()
}

export function PromptPreviewPanel(props: PromptPreviewPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse['preview'] | null>(null)
  const [open, setOpen] = useState(false)

  const { campaignId, promptId, productSlug, industrySlug, useCaseSlug } = props

  const loadPreview = useCallback(async () => {
    const qs = buildPreviewQuery({
      campaignId,
      promptId,
      productSlug,
      industrySlug,
      useCaseSlug,
    })
    if (!qs) {
      setError('Select a prompt or campaign to preview.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await salesEngineFetch<PreviewResponse>(`/api/sales/ai-prompts/preview?${qs}`)
      setPreview(data.preview)
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }, [campaignId, promptId, productSlug, industrySlug, useCaseSlug])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{props.title ?? 'Prompt preview'}</h2>
      <p className="mt-1 text-sm text-slate-600">
        Inspect resolution metadata, variables (preview placeholders when missing), and assembled
        prompts. Preview only — generation still handles blank fields gracefully.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void loadPreview()}
        className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Preview resolved prompt'}
      </button>
      {error ? (
        <div className="mt-2 space-y-2 text-sm text-red-600" role="alert">
          <p>{error}</p>
          {error.includes('No active prompt') ? (
            <p>
              <Link
                href="/dashboard/sales-engine/prompt-library"
                className="font-medium text-indigo-700 hover:text-indigo-900"
              >
                Open Prompt Library
              </Link>
              {' · '}
              Seed all slots:{' '}
              <code className="rounded bg-red-50 px-1 text-xs text-red-800">
                npx tsx --env-file=.env.local scripts/seed-sales-ai-prompts.ts
              </code>
            </p>
          ) : null}
        </div>
      ) : null}
      {open && preview ? (
        <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
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
          <button
            type="button"
            className="text-sm font-medium text-indigo-700"
            onClick={() => setOpen(false)}
          >
            Close preview
          </button>
        </div>
      ) : null}
    </section>
  )
}
