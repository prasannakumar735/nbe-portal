import { RetryButton } from '@/components/ui/RetryButton'

interface DashboardErrorStateProps {
  message?: string
}

export function DashboardErrorState({ message = 'Something went wrong loading the dashboard.' }: DashboardErrorStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <div className="flex justify-center">
        <RetryButton />
      </div>
    </div>
  )
}
