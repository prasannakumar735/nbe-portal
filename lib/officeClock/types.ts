export type OfficeClockSiteRow = {
  id: string
  slug: string
  display_name: string
  client_id: string | null
  location_id: string | null
  work_type_level1_id: string | null
  work_type_level2_id: string | null
  default_break_minutes: number
  default_task: string | null
  billable: boolean
  is_active: boolean
}

export type OfficeAttendanceSessionRow = {
  id: string
  user_id: string
  site_id: string
  clock_in_at: string
  clock_out_at: string | null
  timesheet_entry_id: string | null
}
