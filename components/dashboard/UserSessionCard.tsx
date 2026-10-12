import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { ManagerAttendanceRow } from '@/lib/officeClock/fetchManagerAttendance'
import type { AttendanceDashboard } from '@/lib/officeClock/attendanceDashboard'

export type UserSessionInfo = {
  name: string
  email: string
  role: string
  lastSignInAt: string | null
  attendance: {
    dashboard: AttendanceDashboard | null
    todayRows: ManagerAttendanceRow[]
  }
}

function roleLabel(role: string | null) {
  if (!role) return 'Portal User'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function statusBadge(status: ManagerAttendanceRow['status']) {
  if (status === 'open') return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">In office</span>
  if (status === 'system_logged_out') return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Auto sign-out</span>
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Closed</span>
}

export function UserSessionCard({ info }: { info: UserSessionInfo }) {
  const { dashboard, todayRows } = info.attendance

  return (
    <Card className="hover:shadow-md lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionHeader title="Office Attendance — Today" subtitle="Sign-in & sign-out times (Melbourne)" />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm">
          <div className="text-center">
            <p className="text-xs text-blue-500">Logged in today</p>
            <p className="text-xl font-bold text-blue-900">{dashboard?.loggedInTodayCount ?? 0}</p>
          </div>
          <div className="h-8 w-px bg-blue-200" />
          <div className="text-center">
            <p className="text-xs text-blue-500">In office now</p>
            <p className="text-xl font-bold text-blue-900">{dashboard?.signedInNowCount ?? 0}</p>
          </div>
          <div className="h-8 w-px bg-blue-200" />
          <div className="text-center">
            <p className="text-xs text-blue-500">Avg duration</p>
            <p className="text-xl font-bold text-blue-900">{dashboard?.averageDurationDisplay ?? '—'}</p>
          </div>
          <div className="h-8 w-px bg-blue-200" />
          <div className="text-center">
            <p className="text-xs text-blue-500">Missing sign-out</p>
            <p className="text-xl font-bold text-amber-700">{dashboard?.missingSignOutsInRange ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {todayRows.length === 0 ? (
          <p className="text-sm text-gray-400">No sign-ins recorded today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4">Employee</th>
                  <th className="pb-2 pr-4">Sign In</th>
                  <th className="pb-2 pr-4">Sign Out</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Site</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {todayRows.map(row => (
                  <tr key={row.sessionId} className="hover:bg-gray-50/60">
                    <td className="py-2 pr-4 font-medium text-gray-800">{row.employeeName}</td>
                    <td className="py-2 pr-4 text-gray-600">{row.signInMelbourne}</td>
                    <td className="py-2 pr-4 text-gray-600">{row.signOutMelbourne ?? <span className="italic text-gray-400">—</span>}</td>
                    <td className="py-2 pr-4 text-gray-600">{row.durationDisplay ?? <span className="italic text-gray-400">ongoing</span>}</td>
                    <td className="py-2 pr-4 text-gray-600">{row.siteName}</td>
                    <td className="py-2">{statusBadge(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}
