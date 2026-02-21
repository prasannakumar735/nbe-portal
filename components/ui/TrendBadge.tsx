interface TrendBadgeProps {
  direction: 'up' | 'down' | 'flat'
  value: number
}

export function TrendBadge({ direction, value }: TrendBadgeProps) {
  const isUp = direction === 'up'
  const isDown = direction === 'down'

  const classes = isUp
    ? 'bg-emerald-50 text-emerald-700'
    : isDown
      ? 'bg-rose-50 text-rose-700'
      : 'bg-gray-100 text-gray-600'

  const icon = isUp ? '↑' : isDown ? '↓' : '•'

  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${classes}`}>
      {icon} {value.toFixed(1)}%
    </span>
  )
}
