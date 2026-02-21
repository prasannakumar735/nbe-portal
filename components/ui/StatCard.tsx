import { Card } from './Card'
import { TrendBadge } from './TrendBadge'

interface StatCardProps {
  label: string
  value: string
  trend?: { direction: 'up' | 'down' | 'flat'; value: number }
  helper?: string
}

export function StatCard({ label, value, trend, helper }: StatCardProps) {
  return (
    <Card className="hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
        {trend && <TrendBadge direction={trend.direction} value={trend.value} />}
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-3">{value}</p>
      {helper && <p className="text-sm text-gray-500 mt-1">{helper}</p>}
    </Card>
  )
}
