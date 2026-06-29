'use client'

type PostcodeScanSectionProps = {
  value: string
  onChange: (value: string) => void
  onScan: () => void
  scanning: boolean
  error: string | null
}

export function PostcodeScanSection({
  value,
  onChange,
  onScan,
  scanning,
  error,
}: PostcodeScanSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Discover businesses</h2>
      <p className="mt-1 text-sm text-slate-600">
        Enter one or more Australian postcodes (comma or newline separated).
      </p>
      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="sales-postcodes">
        Postcodes
      </label>
      <textarea
        id="sales-postcodes"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'3012\n3025\n3030'}
        className="mt-1 w-full max-w-xl rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={scanning || !value.trim()}
        onClick={onScan}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {scanning ? 'Scanning…' : 'Scan Businesses'}
      </button>
    </section>
  )
}
