import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatCard } from '@/components/ui/StatCard'
import { WeeklyBarChart } from '@/components/dashboard/charts/WeeklyBarChart'
import { ProjectPieChart } from '@/components/dashboard/charts/ProjectPieChart'
import { TrendLineChart } from '@/components/dashboard/charts/TrendLineChart'
import { BillableStackedBar } from '@/components/dashboard/charts/BillableStackedBar'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import type { AdminDashboardData, DashboardChartData, DashboardEntrySummary } from '@/components/dashboard/types'
import { MaintenanceDistribution } from '@/app/(portal)/components/MaintenanceDistribution'
import { ReimbursementTable } from '@/app/(portal)/components/ReimbursementTable'

interface AdminDashboardProps {
  data: AdminDashboardData
  charts: DashboardChartData
  entriesCount: number
  employeeLeaderboard: { employeeId: string; employeeName: string; hours: number }[]
  recentEntries: DashboardEntrySummary[]
}

export function AdminDashboard({ data, charts, entriesCount, employeeLeaderboard, recentEntries }: AdminDashboardProps) {
  if (entriesCount === 0) {
    return <DashboardEmptyState title="No company time entries" description="Log time to unlock company-wide analytics." />
  }

  return (
    <section className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          label="Total Weekly Hours"
          value={`${data.totalHours.toFixed(1)}h`}
          trend={{ direction: data.comparison.direction, value: data.comparison.changePercent }}
          helper="vs previous period"
        />
        <StatCard
          label="Productivity"
          value={`${data.productivity.toFixed(1)}%`}
          helper="Billable ratio"
        />
        <StatCard
          label="Avg Hours / Employee"
          value={`${data.avgHoursPerEmployee.toFixed(1)}h`}
          helper="Company-wide"
        />
        <StatCard
          label="Active Employees"
          value={String(data.activeEmployees)}
          helper="Currently clocked in"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 hover:shadow-md">
          <SectionHeader title="Weekly Activity" subtitle="Company-wide hours by day" />
          <div className="mt-4">
            <WeeklyBarChart data={charts.weekly} />
          </div>
        </Card>
        <Card className="hover:shadow-md">
          <SectionHeader title="Project Distribution" subtitle="Time split by project" />
          <div className="mt-4">
            <ProjectPieChart data={charts.projectPie} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-md">
          <SectionHeader title="Trend Over Time" subtitle="Weekly hours comparison" />
          <div className="mt-4">
            <TrendLineChart data={charts.trendLine} />
          </div>
        </Card>
        <Card className="hover:shadow-md">
          <SectionHeader title="Billable vs Non-Billable" subtitle="Work mix for recent weeks" />
          <div className="mt-4">
            <BillableStackedBar data={charts.billableStacked} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 hover:shadow-md">
          <SectionHeader title="Employee Performance" subtitle="Top contributors by hours" />
          <div className="mt-4 space-y-3">
            {employeeLeaderboard.map(item => (
              <div key={item.employeeId} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{item.employeeName}</span>
                <span className="font-semibold text-gray-900">{item.hours.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="hover:shadow-md">
          <SectionHeader title="Operational Insights" subtitle="Overwork and idle signals" />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Overwork days</span>
              <span className="font-semibold text-gray-900">{data.overworkDays}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Idle days</span>
              <span className="font-semibold text-gray-900">{data.idleDays}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Most active project</span>
              <span className="font-semibold text-gray-900">{data.mostActiveProject || '—'}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ReimbursementTable />
        <MaintenanceDistribution />
        <Card className="hover:shadow-md">
          <SectionHeader title="Recent Time Entries" subtitle="Latest recorded activity" />
          <div className="mt-4 space-y-3">
            {recentEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{entry.projectName}</span>
                <span className="font-semibold text-gray-900">{entry.hours.toFixed(1)}h</span>
              </div>
            ))}
            {recentEntries.length === 0 && (
              <p className="text-sm text-gray-500">No recent entries.</p>
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}
