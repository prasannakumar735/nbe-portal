interface KpiCardProps {
  label: string
  value: string | number
  trend: number
  trendType: 'positive' | 'negative'
  icon: string
  iconBgColor: string
  iconColor: string
}

export function KpiCard({
  label,
  value,
  trend,
  trendType,
  icon,
  iconBgColor,
  iconColor
}: KpiCardProps) {
  return (
    <article className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 ${iconBgColor} ${iconColor} rounded-lg`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div
          className={`text-xs font-bold px-2 py-1 rounded ${
            trendType === 'positive'
              ? 'text-green-600 bg-green-50'
              : 'text-red-600 bg-red-50'
          }`}
        >
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      </div>
      <p className="text-slate-600 text-sm font-medium mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
    </article>
  )
}
