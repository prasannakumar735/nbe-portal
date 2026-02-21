interface DashboardStatsProps {
  totalHours: number
  topProjectName: string
  topProjectHours: number
  projectsWorked: number
}

export function DashboardStats({
  totalHours,
  topProjectName,
  topProjectHours,
  projectsWorked
}: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <p className="text-xs uppercase tracking-wide text-gray-400">Total Hours</p>
        <p className="text-2xl font-semibold text-gray-900 mt-2">{totalHours.toFixed(2)}h</p>
      </article>

      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <p className="text-xs uppercase tracking-wide text-gray-400">Top Project</p>
        <p className="text-lg font-semibold text-gray-900 mt-2 truncate">{topProjectName || 'No data'}</p>
        <p className="text-sm text-gray-500">{topProjectHours > 0 ? `${topProjectHours.toFixed(2)}h` : '—'}</p>
      </article>

      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <p className="text-xs uppercase tracking-wide text-gray-400">Projects Worked</p>
        <p className="text-2xl font-semibold text-gray-900 mt-2">{projectsWorked}</p>
      </article>
    </div>
  )
}
