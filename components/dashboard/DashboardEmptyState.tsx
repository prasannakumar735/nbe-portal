interface DashboardEmptyStateProps {
  title?: string
  description?: string
}

export function DashboardEmptyState({
  title = 'No time entries yet',
  description = 'Track time to unlock analytics insights for this period.'
}: DashboardEmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <p className="text-lg font-semibold text-gray-900 mb-2">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}
