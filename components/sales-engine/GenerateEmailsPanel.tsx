'use client'

type GenerateEmailsPanelProps = {
  onGenerate: () => void
  generating: boolean
  disabled?: boolean
  hasTemplate: boolean
}

export function GenerateEmailsPanel({
  onGenerate,
  generating,
  disabled,
  hasTemplate,
}: GenerateEmailsPanelProps) {
  const isDisabled = disabled || generating || !hasTemplate

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">AI generation</h2>
      <p className="mt-1 text-sm text-slate-600">
        Generate personalised drafts for every contact in this campaign. Each result starts in{' '}
        <span className="font-medium">draft</span> status for your review.
      </p>
      <button
        type="button"
        disabled={isDisabled}
        onClick={onGenerate}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? 'Generating…' : 'Generate all emails'}
      </button>
    </section>
  )
}
