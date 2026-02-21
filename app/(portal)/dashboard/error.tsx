'use client'

import { useEffect } from 'react'
import { RetryButton } from '@/components/ui/RetryButton'

interface DashboardErrorProps {
  error: Error
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 px-8 py-10">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <p className="text-sm text-gray-600 mb-4">Unable to load dashboard. Please try again.</p>
        <div className="flex justify-center gap-3">
          <RetryButton />
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 border border-gray-200 text-sm font-semibold rounded-lg hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
