export type JobCardStatus = 'pending' | 'in_progress' | 'completed'

/** Stored in gps_start / gps_end JSONB */
export type JobCardGpsPayload = {
  lat: number
  lng: number
  accuracy: number | null
  captured_at: string
}

export type JobCardRow = {
  id: string
  event_id: string | null
  technician_id: string
  client_id: string | null
  location_id: string | null
  job_title: string
  job_description: string | null
  work_type: string | null
  status: JobCardStatus
  start_time: string | null
  end_time: string | null
  gps_start: JobCardGpsPayload | null
  gps_end: JobCardGpsPayload | null
  gps_start_address: string | null
  gps_end_address: string | null
  notes: string | null
  signature_url: string | null
  is_manual: boolean
  created_at: string
  updated_at: string
}

export type JobCardImageRow = {
  id: string
  job_card_id: string
  image_url: string
  created_at: string
}

/** API envelope: job card + optional calendar snapshot for travel/work duration UI */
export type JobCardDetailResponse = {
  job: JobCardRow
  images: JobCardImageRow[]
  calendar?: {
    date: string
    start_time: string | null
    travel_minutes: number
    duration_minutes: number | null
    work_minutes: number | null
  } | null
  labels?: {
    client_name: string | null
    location_label: string | null
  }
}
