'use client'

import { useParams } from 'next/navigation'
import { JobCardScreen } from '@/components/job-card/JobCardScreen'

export default function JobCardByIdPage() {
  const params = useParams()
  const jobId = typeof params?.jobId === 'string' ? params.jobId : ''
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-6">
      <JobCardScreen jobId={jobId} />
    </div>
  )
}
