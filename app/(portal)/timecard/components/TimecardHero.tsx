interface TimecardHeroProps {
  isActiveSession: boolean
}

export function TimecardHero({ isActiveSession }: TimecardHeroProps) {
  return (
    <section className="bg-gradient-to-r from-indigo-900 to-indigo-800 border-b border-indigo-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Timecard & GPS Tracking
            </h1>
            <p className="text-base text-indigo-200">
              Structured employee time tracking for internal operations and reporting.
            </p>
          </div>

          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border ${
            isActiveSession 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isActiveSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`} />
            <span>
              {isActiveSession ? 'Time Running' : 'No Active Session'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
