import { ChevronLeft, ChevronRight, Download, Filter } from 'lucide-react'

interface WeekNavigationProps {
  currentWeekStart: Date
  onPreviousWeek: () => void
  onNextWeek: () => void
  onExport?: () => void
  showBillableOnly: boolean
  onToggleBillable: (checked: boolean) => void
}

export function WeekNavigation({
  currentWeekStart,
  onPreviousWeek,
  onNextWeek,
  onExport,
  showBillableOnly,
  onToggleBillable
}: WeekNavigationProps) {
  const formatWeekRange = (weekStart: Date) => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    
    return `${weekStart.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const isCurrentWeek = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayWeekStart = new Date(today)
    todayWeekStart.setDate(todayWeekStart.getDate() - todayWeekStart.getDay())
    
    return currentWeekStart.getTime() === todayWeekStart.getTime()
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      
      {/* Week Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onPreviousWeek}
          className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors duration-200"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} className="text-slate-600" />
        </button>
        
        <div className="min-w-[200px] text-center">
          <div className="text-sm font-semibold text-slate-900">
            {formatWeekRange(currentWeekStart)}
          </div>
          {isCurrentWeek() && (
            <div className="text-xs text-emerald-600 font-medium mt-0.5">Current Week</div>
          )}
        </div>
        
        <button
          onClick={onNextWeek}
          disabled={isCurrentWeek()}
          className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next week"
        >
          <ChevronRight size={18} className="text-slate-600" />
        </button>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center gap-3">
        
        {/* Billable Filter */}
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={showBillableOnly}
            onChange={(e) => onToggleBillable(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
          />
          <Filter size={16} className="text-slate-600" />
          <span className="text-sm font-medium text-slate-700">Billable Only</span>
        </label>

        {/* Export Button */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-colors duration-200"
          >
            <Download size={16} />
            <span className="hidden sm:inline text-sm">Export</span>
          </button>
        )}
      </div>
    </div>
  )
}
