import type { WeeklyBarDatum } from './charts/WeeklyBarChart'
import type { ProjectPieDatum } from './charts/ProjectPieChart'
import type { TrendLineDatum } from './charts/TrendLineChart'
import type { BillableStackedDatum } from './charts/BillableStackedBar'

export type DashboardRole = 'admin' | 'manager' | 'employee'

export interface DashboardFilters {
  period: 'this_week' | 'last_week' | 'this_month' | 'custom'
  projectId: string
  start?: string
  end?: string
}

export interface DashboardProjectOption {
  id: string
  name: string
}

export interface DashboardChartData {
  weekly: WeeklyBarDatum[]
  projectPie: ProjectPieDatum[]
  trendLine: TrendLineDatum[]
  billableStacked: BillableStackedDatum[]
}

export interface DashboardEntrySummary {
  id: string
  projectName: string
  startTime: string
  hours: number
  status: string
}

export interface AdminDashboardData {
  totalHours: number
  billableRatio: number
  avgHoursPerEmployee: number
  activeEmployees: number
  productivity: number
  mostActiveProject: string
  overworkDays: number
  idleDays: number
  comparison: { direction: 'up' | 'down' | 'flat'; changePercent: number }
  projectBreakdown: { name: string; hours: number }[]
}

export interface EmployeeDashboardData {
  totalHours: number
  productivity: number
  topProject: string
  topProjectHours: number
  projectsWorked: number
  overworkDays: number
  idleDays: number
  comparison: { direction: 'up' | 'down' | 'flat'; changePercent: number }
  recentEntries: DashboardEntrySummary[]
}
