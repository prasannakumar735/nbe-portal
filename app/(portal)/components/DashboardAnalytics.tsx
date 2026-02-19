'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, DollarSign, Clock, Download, Filter } from 'lucide-react'
import { DashboardService } from '@/lib/services/timecard.service'
import type { 
  DashboardSummary, 
  HoursByProject, 
  HoursByClient, 
  WorkTypeMix,
  StaffWorkTypeMatrix,
  DashboardFilters 
} from '@/lib/types/timecard.types'

interface DashboardAnalyticsProps {
  userId: string
  userRole: 'admin' | 'manager' | 'staff' | 'accountant'
}

export default function DashboardAnalytics({ userId, userRole }: DashboardAnalyticsProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [projectHours, setProjectHours] = useState<HoursByProject[]>([])
  const [clientHours, setClientHours] = useState<HoursByClient[]>([])
  const [workTypeMix, setWorkTypeMix] = useState<WorkTypeMix[]>([])
  const [staffMatrix, setStaffMatrix] = useState<StaffWorkTypeMatrix[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [filters, setFilters] = useState<DashboardFilters>({
    start_date: getDefaultStartDate(),
    end_date: new Date().toISOString().split('T')[0],
    employee_id: userRole === 'staff' ? userId : undefined
  })

  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [filters])

  function getDefaultStartDate(): string {
    const date = new Date()
    date.setDate(date.getDate() - 30) // Last 30 days
    return date.toISOString().split('T')[0]
  }

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const [summaryData, projectData, clientData, workTypeData, matrixData] = await Promise.all([
        DashboardService.getSummary(filters),
        DashboardService.getHoursByProject(filters),
        DashboardService.getHoursByClient(filters),
        DashboardService.getWorkTypeMix(filters),
        userRole !== 'staff' ? DashboardService.getStaffWorkTypeMatrix(filters) : Promise.resolve([])
      ])

      setSummary(summaryData)
      setProjectHours(projectData)
      setClientHours(clientData)
      setWorkTypeMix(workTypeData)
      setStaffMatrix(matrixData)
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportData = () => {
    // Create CSV export
    const data = {
      summary,
      projects: projectHours,
      clients: clientHours,
      workTypes: workTypeMix
    }
    
    const csv = JSON.stringify(data, null, 2)
    const blob = new Blob([csv], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timecard-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black">Performance Dashboard</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
          </button>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Billable</label>
              <select
                value={
  filters.billable === undefined || filters.billable === null
    ? ''
    : String(filters.billable)
}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  billable: e.target.value === '' ? undefined : e.target.value === 'true' 
                }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">All</option>
                <option value="true">Billable Only</option>
                <option value="false">Non-Billable Only</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="text-blue-600" size={20} />
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Hours
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {summary?.total_hours.toFixed(1) || '0.0'}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-emerald-600" size={20} />
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Billable Hours
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">
            {summary?.billable_hours.toFixed(1) || '0.0'}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-purple-600" size={20} />
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Billable %
            </div>
          </div>
          <div className="text-3xl font-black text-purple-600">
            {summary?.billable_percentage.toFixed(1) || '0.0'}%
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-amber-600" size={20} />
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Entries
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {summary?.total_entries || 0}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hours by Project */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold mb-4">Hours by Project (Top 10)</h3>
          <div className="space-y-3">
            {projectHours.slice(0, 10).map((project, index) => (
              <div key={project.project_id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {project.project_code} - {project.project_name}
                  </span>
                  <span className="text-sm font-bold">{project.total_hours.toFixed(1)}h</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ 
                      width: `${(project.total_hours / projectHours[0]?.total_hours * 100) || 0}%` 
                    }}
                  />
                </div>
              </div>
            ))}
            {projectHours.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No project data available</p>
            )}
          </div>
        </div>

        {/* Hours by Client */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold mb-4">Hours by Client (Top 10)</h3>
          <div className="space-y-3">
            {clientHours.slice(0, 10).map((client, index) => (
              <div key={client.client_name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {client.client_name}
                  </span>
                  <span className="text-sm font-bold">{client.total_hours.toFixed(1)}h</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ 
                      width: `${(client.total_hours / clientHours[0]?.total_hours * 100) || 0}%` 
                    }}
                  />
                </div>
              </div>
            ))}
            {clientHours.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No client data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Work Type Mix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold mb-4">Work Type Distribution</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Work Type</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Hours</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">%</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Billable</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workTypeMix.map((wt) => (
                <tr key={`${wt.work_type_level1_id}-${wt.work_type_level2_id}`} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="text-sm font-bold">{wt.work_type_level2_description}</div>
                    <div className="text-xs text-slate-500">{wt.work_type_level1_description}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold">{wt.total_hours.toFixed(1)}</td>
                  <td className="py-3 px-4 text-center font-medium">{wt.percentage.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-center">
                    {wt.billable ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                        Yes
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">
                        No
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${wt.billable ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        style={{ width: `${wt.percentage}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {workTypeMix.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No work type data available</p>
          )}
        </div>
      </div>

      {/* Staff Work Type Heatmap (Manager/Admin only) */}
      {userRole !== 'staff' && staffMatrix.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold mb-4">Staff × Work Type Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase sticky left-0 bg-white">
                    Staff
                  </th>
                  {Array.from(new Set(staffMatrix.flatMap(s => Object.keys(s.work_type_hours)))).map(wtId => (
                    <th key={wtId} className="text-center py-3 px-2 text-xs font-bold text-slate-500 uppercase">
                      {wtId}
                    </th>
                  ))}
                  <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffMatrix.map((staff) => {
                  const allWorkTypes = Array.from(new Set(staffMatrix.flatMap(s => Object.keys(s.work_type_hours))))
                  const maxHours = Math.max(...Object.values(staff.work_type_hours))
                  
                  return (
                    <tr key={staff.employee_id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold sticky left-0 bg-white">
                        {staff.employee_name || staff.employee_id.substring(0, 8)}
                      </td>
                      {allWorkTypes.map(wtId => {
                        const hours = staff.work_type_hours[wtId] || 0
                        const intensity = hours > 0 ? (hours / maxHours) : 0
                        
                        return (
                          <td 
                            key={wtId} 
                            className="py-3 px-2 text-center"
                            style={{
                              backgroundColor: hours > 0 
                                ? `rgba(59, 130, 246, ${0.2 + (intensity * 0.8)})` 
                                : 'transparent'
                            }}
                          >
                            {hours > 0 ? hours.toFixed(1) : '-'}
                          </td>
                        )
                      })}
                      <td className="py-3 px-4 text-center font-black">
                        {staff.total_hours.toFixed(1)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
