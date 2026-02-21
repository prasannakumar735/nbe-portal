'use client'

import { useRouter } from 'next/navigation'

interface RetryButtonProps {
  label?: string
}

export function RetryButton({ label = 'Retry' }: RetryButtonProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
    >
      {label}
    </button>
  )
}
