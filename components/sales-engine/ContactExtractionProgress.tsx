'use client'

type ContactExtractionProgressProps = {
  active: boolean
  completed: number
  total: number
}

export function ContactExtractionProgress({
  active,
  completed,
  total,
}: ContactExtractionProgressProps) {
  if (!active && completed === 0) return null

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <section
      className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 sm:p-6 shadow-sm"
      aria-live="polite"
    >
      <h2 className="text-lg font-semibold text-slate-900">Contact Discovery</h2>
      <p className="mt-2 text-sm text-slate-700">
        {active ? 'Extracting contacts…' : 'Extraction complete.'}{' '}
        <span className="font-medium text-indigo-900">
          {completed} / {total} completed
        </span>
      </p>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-indigo-100">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
          style={{ width: `${active ? Math.max(pct, completed > 0 ? 8 : 0) : 100}%` }}
        />
      </div>
    </section>
  )
}
