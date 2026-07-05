'use client'

import { useCallback, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'

type PreviewResponse = {
  preview: {
    systemPrompt: string
    userPrompt: string
    promptName: string
    promptVersion: number
    variables: PromptRenderVariables
    product_slug: string
    industry_slug: string
    use_case_slug: string
    resolution_path: string[]
  }
}

type PromptPreviewPanelProps = {
  campaignId: string
}

export function PromptPreviewPanel({ campaignId }: PromptPreviewPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse['preview'] | null>(null)
  const [open, setOpen] = useState(false)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await salesEngineFetch<PreviewResponse>(
        `/api/sales/ai-prompts/preview?campaignId=${encodeURIComponent(campaignId)}`,
      )
      setPreview(data.preview)
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Prompt preview</h2>
      <p className="mt-1 text-sm text-slate-600">
        Inspect resolved system prompt, variables, and rendered user prompt before generating emails.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void loadPreview()}
        className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Preview resolved prompt'}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {open && preview ? (
        <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p>
            <span className="font-semibold text-slate-900">{preview.promptName}</span>
            <span className="text-slate-600"> · v{preview.promptVersion}</span>
          </p>
          <p className="text-xs text-slate-500">{preview.resolution_path.join(' → ')}</p>
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
