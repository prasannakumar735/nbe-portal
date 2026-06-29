'use client'

type SaveCampaignButtonProps = {
  onSave: () => void
  saving: boolean
  disabled?: boolean
}

export function SaveCampaignButton({ onSave, saving, disabled = false }: SaveCampaignButtonProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Save Campaign Draft</h2>
      <p className="mt-1 text-sm text-slate-600">
        Store this audience and campaign details for AI email generation (next phase).
      </p>
      <button
        type="button"
        disabled={disabled || saving}
        onClick={onSave}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Campaign Draft'}
      </button>
    </section>
  )
}
