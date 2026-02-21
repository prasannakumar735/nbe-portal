import { Clock, FileText, DollarSign } from 'lucide-react'

interface SummaryData {
  entriesThisWeek: number
  totalHours: number
  billableHours: number
}

interface TimecardSummaryCardsProps {
  data: SummaryData
  isLoading?: boolean
}

export function TimecardSummaryCards({ data, isLoading }: TimecardSummaryCardsProps) {
  const cards = [
    {
      icon: FileText,
      label: 'Entries This Week',
      value: data.entriesThisWeek,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      icon: Clock,
      label: 'Total Hours',
      value: data.totalHours.toFixed(2),
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      icon: DollarSign,
      label: 'Billable Hours',
      value: data.billableHours.toFixed(2),
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon size={20} className={card.color} />
              </div>
              <h3 className="text-sm font-medium text-slate-600">{card.label}</h3>
            </div>
            <div className={`text-3xl font-semibold text-slate-900 ${isLoading ? 'animate-pulse' : ''}`}>
              {isLoading ? '—' : card.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}
