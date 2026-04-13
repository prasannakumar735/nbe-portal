export type EventType = 'task' | 'block' | 'leave' | 'meeting'
export type EventStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type CalendarLocationMode = 'client' | 'manual'

export type CalendarEventRow = {
  id: string
  title: string
  description: string | null
  assigned_to: string
  created_by: string
  event_type: EventType
  date: string
  start_time: string | null
  end_time: string | null
  is_full_day: boolean
  duration_minutes: number | null
  client_id: string | null
  location_id: string | null
  location_mode: CalendarLocationMode
  location_text: string | null
  location_lat: number | null
  location_lng: number | null
  travel_minutes: number
  total_minutes: number
  status: EventStatus
  /** From joined `clients` when listing events (optional). */
  client_name?: string | null
  /** Site / location label from joined `client_locations` when listing (optional). */
  client_location_label?: string | null
  /** Horizontal stack index for overlapping events in board UI (0-based). */
  overlap_position?: number | null
  /** Optional sub-lane / dispatch grouping. */
  lane_id?: string | null
  created_at: string
  updated_at: string
}

export type ProfileOption = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
}
