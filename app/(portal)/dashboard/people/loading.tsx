export default function PeopleLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2 border-b border-slate-200 pb-4">
        <div className="h-8 w-32 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 rounded bg-slate-100" />
        <div className="mt-4 h-11 max-w-md rounded-lg bg-slate-200" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="h-10 w-28 rounded-lg bg-slate-200 sm:ml-auto" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-16 rounded-lg bg-slate-100" />
          <div className="h-16 rounded-lg bg-slate-100" />
          <div className="h-16 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
