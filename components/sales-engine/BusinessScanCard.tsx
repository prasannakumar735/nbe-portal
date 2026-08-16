'use client'

type BusinessScanCardProps = {
  postcode: string
  onPostcodeChange: (value: string) => void
  onScan: () => void
  onRefreshFromGoogle: () => void
  scanning: boolean
  error: string | null
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export function BusinessScanCard({
  postcode,
  onPostcodeChange,
  onScan,
  onRefreshFromGoogle,
  scanning,
  error,
}: BusinessScanCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Business Discovery</h2>
      <p className="mt-1 text-sm text-slate-600">
        Scan Australian businesses by postcode to build your outreach list.
      </p>
      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="sales-postcode">
        Postcode
      </label>
      <input
        id="sales-postcode"
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={postcode}
        onChange={(e) => onPostcodeChange(e.target.value)}
        placeholder="3025"
        className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {error ? (
        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={scanning || !postcode.trim()}
          onClick={onScan}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {scanning ? (
            <>
              <Spinner />
              Scanning…
            </>
          ) : (
            'Scan Businesses'
          )}
        </button>
        <button
          type="button"
          disabled={scanning || !postcode.trim()}
          onClick={onRefreshFromGoogle}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh from Google
        </button>
      </div>
    </section>
  )
}
