'use client'

import { Suspense } from 'react'
import TimecardApp from '@/app/(portal)/timecard/TimecardApp'
import { TimecardSkeleton } from '@/components/timecard'

/** Weekly timesheet: entries, submit, export — same UI as legacy `/timecard`. */
export function MyTimecardTab() {
  return (
    <Suspense fallback={<TimecardSkeleton />}>
      <TimecardApp />
    </Suspense>
  )
}
