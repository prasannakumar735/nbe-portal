import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { WeeklyBarChart } from '@/components/dashboard/charts/WeeklyBarChart'
import { ProjectPieChart } from '@/components/dashboard/charts/ProjectPieChart'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import type { DashboardChartData, EmployeeDashboardData } from '@/components/dashboard/types'

interface EmployeeDashboardProps {
  data: EmployeeDashboardData
  charts: DashboardChartData
  entriesCount: number
}

export function EmployeeDashboard({ data, charts, entriesCount }: EmployeeDashboardProps) {
  if (entriesCount === 0) {
    return (
      <div className="space-y-6">
        <DashboardEmptyState title="No time entries yet" description="Start a work session to unlock your analytics." />
        <Link
          href="/dashboard/timecards"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Quick start work
        </Link>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">My Time Analytics</h2>
          <p className="text-sm text-gray-500">Track your weekly productivity</p>
        </div>
        <Link
          href="/dashboard/timecards"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Quick start work
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Weekly Hours"
          value={`${data.totalHours.toFixed(1)}h`}
          trend={{ direction: data.comparison.direction, value: data.comparison.changePercent }}
        />
        <StatCard
          label="Productivity"
          value={`${data.productivity.toFixed(1)}%`}
          helper="Billable ratio"
        />
        <StatCard
          label="Top Project"
          value={data.topProject || '—'}
          helper={data.topProjectHours ? `${data.topProjectHours.toFixed(1)}h` : 'No data'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 hover:shadow-md">
          <SectionHeader title="Weekly Activity" subtitle="Hours by weekday" />
          <div className="mt-4">
            <WeeklyBarChart data={charts.weekly} />
          </div>
        </Card>
        <Card className="hover:shadow-md">
          <SectionHeader title="Project Distribution" subtitle="Your time by project" />
          <div className="mt-4">
            <ProjectPieChart data={charts.projectPie} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md">
          <SectionHeader title="Projects Worked" subtitle="Distinct projects in period" />
          <p className="text-3xl font-bold text-gray-900 mt-4">{data.projectsWorked}</p>
        </Card>
        <Card className="hover:shadow-md">
          <SectionHeader title="Overwork Days" subtitle="Days above 9 hours" />
          <p className="text-3xl font-bold text-gray-900 mt-4">{data.overworkDays}</p>
        </Card>
        <Card className="hover:shadow-md">
          <SectionHeader title="Idle Days" subtitle="No time logged" />
          <p className="text-3xl font-bold text-gray-900 mt-4">{data.idleDays}</p>
        </Card>
      </div>

      <Card className="hover:shadow-md">
        <SectionHeader title="Recent Entries" subtitle="Latest logged activity" />
        <div className="mt-4 space-y-3">
          {data.recentEntries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-700">{entry.projectName}</p>
                <p className="text-xs text-gray-400">{new Date(entry.startTime).toLocaleDateString()}</p>
              </div>
              <span className="font-semibold text-gray-900">{entry.hours.toFixed(1)}h</span>
            </div>
          ))}
          {data.recentEntries.length === 0 && (
            <p className="text-sm text-gray-500">No recent entries.</p>
          )}
        </div>
      </Card>
    </section>
  )
}
