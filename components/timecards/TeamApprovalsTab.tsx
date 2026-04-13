'use client'

import { ManagerDashboard } from '@/components/manager-timecards/ManagerDashboard'

/** Pending approvals — same UI as legacy `/manager/timecards`. */
export function TeamApprovalsTab() {
  return (
    <div className="w-full">
      <ManagerDashboard />
    </div>
  )
}
