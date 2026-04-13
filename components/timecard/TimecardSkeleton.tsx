export function TimecardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-pulse rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="h-7 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-100" />
        <div className="mt-4 flex gap-2">
          <div className="h-6 w-20 rounded-full bg-slate-100" />
          <div className="h-6 w-24 rounded-full bg-slate-100" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <div className="h-10 w-28 rounded-lg bg-slate-100" />
          <div className="h-10 w-28 rounded-lg bg-slate-100" />
          <div className="h-10 w-32 rounded-lg bg-slate-100" />
          <div className="h-10 w-36 rounded-lg bg-indigo-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex gap-3">
              <div className="size-10 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-slate-100" />
                <div className="h-6 w-24 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-16 rounded-lg bg-slate-50" />
            <div className="mt-2 h-16 rounded-lg bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  )
}
