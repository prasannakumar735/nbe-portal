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
      <p className="mt-1.5 text-xl font-bold text-gray-900">{value}</p>
      {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </Card>
  )
}
