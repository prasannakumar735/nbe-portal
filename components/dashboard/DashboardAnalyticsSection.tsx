import { AlertCircle } from 'lucide-react'
import { DashboardStats } from './DashboardStats'
import { DashboardWeeklyChart, type WeeklyChartDatum } from './DashboardWeeklyChart'
import { DashboardProjectPie, type ProjectPieDatum } from './DashboardProjectPie'
import { DashboardEmptyState } from './DashboardEmptyState'

interface DashboardAnalyticsSectionProps {
  isLoading: boolean
  errorMessage: string | null
  isRangeIncomplete: boolean
  entriesCount: number
  totalHours: number
  topProjectName: string
  topProjectHours: number
  projectsWorked: number
  dailyData: WeeklyChartDatum[]
  pieData: ProjectPieDatum[]
}

export function DashboardAnalyticsSection({
  isLoading,
  errorMessage,
  isRangeIncomplete,
  entriesCount,
  totalHours,
  topProjectName,
  topProjectHours,
  projectsWorked,
  dailyData,
  pieData
}: DashboardAnalyticsSectionProps) {
  return (
    <section className="space-y-6">
      <div className="border-t border-gray-200 pt-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">My Time Analytics</h2>
          <p className="text-sm text-gray-500">Track your weekly productivity</p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`stat-skeleton-${index}`}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse"
                >
                  <div className="h-3 w-24 bg-gray-200 rounded mb-4" />
                  <div className="h-6 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
                <div className="h-3 w-40 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-32 bg-gray-200 rounded mb-6" />
                <div className="h-48 w-full bg-gray-200 rounded" />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
                <div className="h-3 w-40 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-32 bg-gray-200 rounded mb-6" />
                <div className="h-48 w-full bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
        ) : isRangeIncomplete ? (
          <DashboardEmptyState
            title="Select a custom range"
            description="Choose a start and end date to view analytics for a custom period."
          />
        ) : entriesCount === 0 ? (
          <DashboardEmptyState />
        ) : (
          <>
            <DashboardStats
              totalHours={totalHours}
              topProjectName={topProjectName}
              topProjectHours={topProjectHours}
              projectsWorked={projectsWorked}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <article className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Weekly Hours</h3>
                  <p className="text-sm text-gray-500">Hours logged by weekday</p>
                </div>
                <DashboardWeeklyChart data={dailyData} />
              </article>

              <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Project Distribution</h3>
                  <p className="text-sm text-gray-500">Share of time by project</p>
                </div>
                <DashboardProjectPie data={pieData} />
              </article>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
