import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { TopNavigation } from '../components/TopNavigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { FilterBar } from '@/components/ui/FilterBar'
import { AdminDashboard } from '@/components/dashboard/admin/AdminDashboard'
import { EmployeeDashboard } from '@/components/dashboard/employee/EmployeeDashboard'
import { DashboardErrorState } from '@/components/dashboard/DashboardErrorState'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { calculateWeeklyStats } from '@/lib/analytics/calculateWeeklyStats'
import { calculateProjectBreakdown } from '@/lib/analytics/calculateProjectBreakdown'
import { calculateTrendComparison } from '@/lib/analytics/calculateTrendComparison'
import type { DashboardRole, DashboardProjectOption } from '@/components/dashboard/types'
import type { WeeklyBarDatum } from '@/components/dashboard/charts/WeeklyBarChart'
import type { ProjectPieDatum } from '@/components/dashboard/charts/ProjectPieChart'
import type { TrendLineDatum } from '@/components/dashboard/charts/TrendLineChart'
import type { BillableStackedDatum } from '@/components/dashboard/charts/BillableStackedBar'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = {
  period?: string
  project?: string
  start?: string
  end?: string
}

type TimeEntryRow = {
  id: string
  employee_id: string
  client_id: string
  start_time: string
  end_time: string | null
  hours: number | null
  billable: boolean | null
  status: string | null
}

function resolvePeriod(period?: string) {
  if (period === 'this_week' || period === 'last_week' || period === 'this_month' || period === 'custom') {
    return period
  }
  return 'this_week'
}

function getDateRange(period: string, start?: string, end?: string) {
  const now = new Date()

  if (period === 'this_month') {
    const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    return { start: rangeStart, end: rangeEnd }
  }

  if (period === 'custom' && start && end) {
    const rangeStart = new Date(start)
    const rangeEnd = new Date(end)
    rangeEnd.setHours(23, 59, 59, 999)
    return { start: rangeStart, end: rangeEnd }
  }

  const monday = new Date(now)
  const day = monday.getDay()
  const offset = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + offset)
  monday.setHours(0, 0, 0, 0)

  if (period === 'last_week') {
    const rangeStart = new Date(monday)
    rangeStart.setDate(rangeStart.getDate() - 7)
    const rangeEnd = new Date(rangeStart)
    rangeEnd.setDate(rangeStart.getDate() + 6)
    rangeEnd.setHours(23, 59, 59, 999)
    return { start: rangeStart, end: rangeEnd }
  }

  const rangeStart = new Date(monday)
  const rangeEnd = new Date(monday)
  rangeEnd.setDate(rangeEnd.getDate() + 6)
  rangeEnd.setHours(23, 59, 59, 999)
  return { start: rangeStart, end: rangeEnd }
}

function getPreviousRange(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diff)
  return { start: prevStart, end: prevEnd }
}

function buildTrendLine(entries: TimeEntryRow[]): TrendLineDatum[] {
  const weeklyTotals = entries.reduce<Record<string, number>>((acc, entry) => {
    const date = new Date(entry.start_time)
    const day = date.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(monday.getDate() + mondayOffset)
    const key = monday.toISOString().split('T')[0]
    const hours = typeof entry.hours === 'number' && Number.isFinite(entry.hours)
      ? entry.hours
      : entry.end_time
        ? Math.max(0, new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000
        : 0

    acc[key] = (acc[key] || 0) + hours
    return acc
  }, {})

  return Object.entries(weeklyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, hours]) => ({ label, hours: Number(hours.toFixed(2)) }))
}

function buildBillableStacked(entries: TimeEntryRow[]): BillableStackedDatum[] {
  const weeklyTotals = entries.reduce<Record<string, { billable: number; nonBillable: number }>>((acc, entry) => {
    const date = new Date(entry.start_time)
    const day = date.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(monday.getDate() + mondayOffset)
    const key = monday.toISOString().split('T')[0]
    const hours = typeof entry.hours === 'number' && Number.isFinite(entry.hours)
      ? entry.hours
      : entry.end_time
        ? Math.max(0, new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000
        : 0

    if (!acc[key]) {
      acc[key] = { billable: 0, nonBillable: 0 }
    }

    if (entry.billable) {
      acc[key].billable += hours
    } else {
      acc[key].nonBillable += hours
    }

    return acc
  }, {})

  return Object.entries(weeklyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, values]) => ({
      label,
      billable: Number(values.billable.toFixed(2)),
      nonBillable: Number(values.nonBillable.toFixed(2))
    }))
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServerClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    redirect('/')
  }

  const user = authData.user
  const period = resolvePeriod(searchParams.period)
  const projectId = searchParams.project || 'all'
  const range = getDateRange(period, searchParams.start, searchParams.end)
  const isCustomIncomplete = period === 'custom' && (!searchParams.start || !searchParams.end)

  let errorMessage: string | null = null
  let role: DashboardRole | null = null
  let entries: TimeEntryRow[] = []
  let previousEntries: TimeEntryRow[] = []
  let trendEntries: TimeEntryRow[] = []
  let projectOptions: DashboardProjectOption[] = []
  let employeeLeaderboard: { employeeId: string; employeeName: string; hours: number }[] = []
  let recentEntries: { id: string; projectName: string; startTime: string; hours: number; status: string }[] = []
  let activeEmployees = 0

  if (!isCustomIncomplete) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        throw profileError
      }

      console.log('[dashboard] user.id', user.id)
      console.log('[dashboard] profile.role', profileData?.role)

      role = (profileData?.role as DashboardRole | null) ?? null
      const isPrivileged = role === 'admin' || role === 'manager'

      const baseQuery = supabase
        .from('time_entries')
        .select('id, employee_id, client_id, start_time, end_time, hours, billable, status')
        .neq('status', 'active')
        .gte('start_time', range.start.toISOString())
        .lte('start_time', range.end.toISOString())

      const currentQuery = isPrivileged ? baseQuery : baseQuery.eq('employee_id', user.id)

      if (projectId !== 'all') {
        currentQuery.eq('client_id', projectId)
      }

      const { data: currentEntries, error: currentError } = await currentQuery.order('start_time', { ascending: true })

      if (currentError) throw currentError

      entries = (currentEntries || []) as TimeEntryRow[]

      const previousRange = getPreviousRange(range.start, range.end)
      const previousQuery = supabase
        .from('time_entries')
        .select('id, employee_id, client_id, start_time, end_time, hours, billable, status')
        .neq('status', 'active')
        .gte('start_time', previousRange.start.toISOString())
        .lte('start_time', previousRange.end.toISOString())

      const prevScoped = isPrivileged ? previousQuery : previousQuery.eq('employee_id', user.id)
      const { data: prevEntries, error: prevError } = await prevScoped

      if (prevError) throw prevError
      previousEntries = (prevEntries || []) as TimeEntryRow[]

      const trendStart = new Date(range.end)
      trendStart.setDate(trendStart.getDate() - 56)
      const trendQuery = supabase
        .from('time_entries')
        .select('id, employee_id, client_id, start_time, end_time, hours, billable, status')
        .neq('status', 'active')
        .gte('start_time', trendStart.toISOString())
        .lte('start_time', range.end.toISOString())

      const trendScoped = isPrivileged ? trendQuery : trendQuery.eq('employee_id', user.id)
      const { data: trendData, error: trendError } = await trendScoped

      if (trendError) throw trendError
      trendEntries = (trendData || []) as TimeEntryRow[]

      const clientIds = Array.from(new Set(entries.map(entry => entry.client_id)))
      if (clientIds.length > 0) {
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds)

        if (clientsError) throw clientsError

        projectOptions = (clients || [])
          .map(client => ({ id: client.id, name: client.name || 'Unnamed project' }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }

      
      // Fetch employee profiles
      const employeeIds = Array.from(new Set(entries.map(e => e.employee_id)))
      let profilesMap: Record<string, { first_name: string | null, last_name: string | null }> = {}
      
      if (employeeIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', employeeIds)
        
        if (!profilesError && profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = { first_name: p.first_name, last_name: p.last_name }
          })
        }
      }

      if (isPrivileged) {
        const { data: activeEntries } = await supabase
          .from('time_entries')
          .select('employee_id')
          .eq('status', 'active')

        activeEmployees = new Set((activeEntries || []).map(entry => entry.employee_id)).size
      }

      const leaderboard = entries.reduce<Record<string, { hours: number; firstName: string | null; lastName: string | null }>>((acc, entry) => {
        const hours = typeof entry.hours === 'number' && Number.isFinite(entry.hours)
          ? entry.hours
          : entry.end_time
            ? Math.max(0, new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000
            : 0

        if (!acc[entry.employee_id]) {
          const profile = profilesMap[entry.employee_id]
          acc[entry.employee_id] = {
            hours: 0,
            firstName: profile?.first_name || null,
            lastName: profile?.last_name || null
          }
        }
        acc[entry.employee_id].hours += hours
        return acc
      }, {})


      employeeLeaderboard = Object.entries(leaderboard)
        .map(([employeeId, data]) => ({
          employeeId,
          employeeName: data.firstName && data.lastName
            ? `${data.firstName} ${data.lastName}`
            : data.firstName || data.lastName || 'Unknown Employee',
          hours: Number(data.hours.toFixed(2))
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 6)

      recentEntries = entries
        .slice()
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, 6)
        .map(entry => ({
          id: entry.id,
          projectName: projectOptions.find(project => project.id === entry.client_id)?.name || 'Unnamed project',
          startTime: entry.start_time,
          hours: typeof entry.hours === 'number' && Number.isFinite(entry.hours)
            ? entry.hours
            : entry.end_time
              ? Math.max(0, new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000
              : 0,
          status: entry.status || 'completed'
        }))
    } catch (error) {
      console.error('[dashboard] load failed:', error)
      errorMessage = 'Unable to load dashboard insights. Please try again.'
    }
  }

  const weeklyStats = calculateWeeklyStats(entries)
  const previousStats = calculateWeeklyStats(previousEntries)
  const comparison = calculateTrendComparison(weeklyStats.totalHours, previousStats.totalHours)
  const projectBreakdown = calculateProjectBreakdown(entries, projectOptions.reduce<Record<string, string>>((acc, project) => {
    acc[project.id] = project.name
    return acc
  }, {}))
  const topProject = projectBreakdown[0]

  const charts = {
    weekly: weeklyStats.dailyHours as WeeklyBarDatum[],
    projectPie: projectBreakdown.map(item => ({ name: item.name, value: item.totalHours })) as ProjectPieDatum[],
    trendLine: buildTrendLine(trendEntries) as TrendLineDatum[],
    billableStacked: buildBillableStacked(trendEntries) as BillableStackedDatum[]
  }

  const employeeData = {
    totalHours: weeklyStats.totalHours,
    productivity: weeklyStats.totalHours > 0 ? (weeklyStats.billableHours / weeklyStats.totalHours) * 100 : 0,
    topProject: topProject?.name || '—',
    topProjectHours: topProject?.totalHours || 0,
    projectsWorked: projectBreakdown.length,
    overworkDays: weeklyStats.overworkDays,
    idleDays: weeklyStats.idleDays,
    comparison,
    recentEntries
  }

  const adminData = {
    totalHours: weeklyStats.totalHours,
    billableRatio: weeklyStats.totalHours > 0 ? (weeklyStats.billableHours / weeklyStats.totalHours) * 100 : 0,
    avgHoursPerEmployee: entries.length
      ? weeklyStats.totalHours / Math.max(1, new Set(entries.map(entry => entry.employee_id)).size)
      : 0,
    activeEmployees,
    productivity: weeklyStats.totalHours > 0 ? (weeklyStats.billableHours / weeklyStats.totalHours) * 100 : 0,
    mostActiveProject: topProject?.name || '—',
    overworkDays: weeklyStats.overworkDays,
    idleDays: weeklyStats.idleDays,
    comparison,
    projectBreakdown: projectBreakdown.map(item => ({ name: item.name, hours: item.totalHours }))
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <TopNavigation user={{ id: user.id, email: user.email, user_metadata: user.user_metadata }} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-8 pb-10">
          <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-100 py-6">
            <DashboardHeader
              title="Dashboard"
              subtitle="Time insights & performance overview"
              actions={
                <FilterBar
                  projects={projectOptions}
                  defaultPeriod="this_week"
                  defaultProject="all"
                />
              }
            />
          </div>

          <div className="space-y-8 pt-6">
            {errorMessage ? (
              <DashboardErrorState message={errorMessage} />
            ) : isCustomIncomplete ? (
              <DashboardErrorState message="Select a custom date range to view analytics." />
            ) : (
              <Suspense fallback={<LoadingSkeleton rows={3} />}>
                {role === 'admin' || role === 'manager' ? (
                  <AdminDashboard
                    data={adminData}
                    charts={charts}
                    entriesCount={entries.length}
                    employeeLeaderboard={employeeLeaderboard}
                    recentEntries={recentEntries}
                  />
                ) : (
                  <EmployeeDashboard data={employeeData} charts={charts} entriesCount={entries.length} />
                )}
              </Suspense>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
