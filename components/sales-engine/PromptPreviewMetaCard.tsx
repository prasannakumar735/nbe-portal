'use client'

import type { PromptPreviewMeta } from '@/lib/sales/prompts/promptPreviewMeta'

type PromptPreviewMetaCardProps = {
  meta: PromptPreviewMeta
  className?: string
}

function ResolutionStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
    </div>
  )
}

export function PromptPreviewMetaCard({ meta, className }: PromptPreviewMetaCardProps) {
  return (
    <div className={className ?? 'space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm'}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prompt Name</p>
          <p className="mt-0.5 font-medium text-slate-900">{meta.promptDescription || meta.resolvedLabel}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prompt Version</p>
          <p className="mt-0.5 font-medium text-slate-900">v{meta.promptVersion}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Resolution Path
        </p>
        <div className="flex flex-col items-stretch gap-1">
          <ResolutionStep label="Product" value={meta.productLabel} />
          <p className="text-center text-slate-400" aria-hidden>
            ↓
          </p>
          <ResolutionStep label="Industry" value={meta.industryLabel} />
          <p className="text-center text-slate-400" aria-hidden>
            ↓
          </p>
          <ResolutionStep label="Use Case" value={meta.useCaseLabel} />
          <p className="text-center text-slate-400" aria-hidden>
            ↓
          </p>
          <ResolutionStep label="Resolved Prompt" value={meta.resolvedLabel} />
        </div>
        {meta.resolutionPath.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Debug trail: {meta.resolutionPath.join(' → ')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
