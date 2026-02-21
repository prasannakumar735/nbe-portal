import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 px-8 py-10">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <LoadingSkeleton rows={4} />
      </div>
    </div>
  )
}
