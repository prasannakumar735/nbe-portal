import type { EmployeeWeeklyTimesheet } from '@/lib/types/employee-timesheet.types'

export type PendingTimecardRow = {
  timesheet: EmployeeWeeklyTimesheet
  employeeUserId: string
  employeeName: string
}
