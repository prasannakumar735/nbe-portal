export type ClientContactEmailRow = {
  id: string
  client_id: string
  name: string | null
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ClientServiceDueReminderRow = {
  id: string
  client_id: string
  client_location_id: string | null
  title: string
  notes: string | null
  last_service_date: string | null
  service_interval_months: number | null
  due_date: string
  lead_time_days: number
  send_manager_email: boolean
  send_client_email: boolean
  client_contact_email: string | null
  client_contact_name: string | null
  client_contact_email_id: string | null
  status: 'active' | 'cancelled' | 'done'
  reminder_sent_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  client_name?: string | null
}
