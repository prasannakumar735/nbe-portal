interface LoadingSkeletonProps {
  rows?: number
}

export function LoadingSkeleton({ rows = 3 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`skeleton-${index}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
          <div className="h-3 w-32 bg-gray-200 rounded mb-3" />
          <div className="h-6 w-24 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}
