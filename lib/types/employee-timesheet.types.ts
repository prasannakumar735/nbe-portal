export type EmployeeTimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type GpsPoint = {
  lat: number
  lng: number
  accuracy?: number
}

/** Structured reverse-geocode result (stored in gps_*_meta JSONB). */
export type GpsAddressMeta = {
  formattedAddress: string
  suburb: string | null
  state: string | null
  postcode: string | null
  country: string | null
}

/** One line on the weekly timesheet */
export type EmployeeTimesheetEntry = {
  id: string
  timesheet_id?: string | null
  entry_date: string
  client_id: string | null
  location_id: string | null
  work_type_level1_id: string | null
  work_type_level2_id: string | null
  /** Free-text task / description */
  task: string
  /** HH:mm (24h) */
  start_time: string
  /** HH:mm (24h) */
  end_time: string
  break_minutes: number
  total_hours: number
  billable: boolean
  notes: string
  gps_start: GpsPoint | null
  gps_end: GpsPoint | null
  /** Single-line reverse-geocoded address for gps_start */
  gps_start_address: string | null
  gps_start_meta: GpsAddressMeta | null
  gps_end_address: string | null
  gps_end_meta: GpsAddressMeta | null
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type EmployeeWeeklyTimesheet = {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  total_hours: number
  billable_hours: number
  status: EmployeeTimesheetStatus
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  rejected_at?: string | null
  rejected_by?: string | null
  updated_at: string
}

export type TimecardSaveStatus = 'idle' | 'loading' | 'saving' | 'saved_offline' | 'synced' | 'error'
