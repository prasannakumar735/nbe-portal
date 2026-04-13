/** Manager Reports module — shared types (filters, API payloads). */

export type ReportsTab = 'timecards' | 'maintenance' | 'gps' | 'quotes'

export type BillableFilter = 'all' | 'yes' | 'no'

export type ReportsFilters = {
  dateFrom: string
  dateTo: string
  clientId: string | null
  technicianId: string | null
  workTypeLevel1Id: string | null
  billable: BillableFilter
  locationId: string | null
}

/** Resolved names for export/print filter blocks (replaces raw UUIDs). */
export type ReportsFilterLabels = {
  clientName?: string | null
  locationName?: string | null
  technicianName?: string | null
  workTypeName?: string | null
}

export type TimecardGroupBy = 'day' | 'technician' | 'client'

export type ReportsSummary = {
  totalHours: number
  billableHours: number
  nonBillableHours: number
  /** 0–100 when totalHours > 0 */
  billablePercent: number
  jobsCompleted: number
  revenueTotal: number
  activeTechnicians: number
  /** Optional series for charts */
  hoursByDay: { date: string; hours: number }[]
  revenueByDay: { date: string; amount: number }[]
  /** For technician bar chart (top performers) */
  hoursByTechnician: { name: string; hours: number }[]
}

export type TimecardReportRow = {
  id: string
  entry_date: string
  technician_id: string
  technician_name: string
  client_id: string | null
  client_name: string
  location_id: string | null
  location_label: string
  work_type: string
  task: string
  start_time: string
  end_time: string
  break_minutes: number
  total_hours: number
  billable: boolean
}

export type TimecardGroupedResponse = {
  groupBy: TimecardGroupBy
  groups: Array<{
    key: string
    label: string
    rows: TimecardReportRow[]
    subtotalHours: number
  }>
  grandTotalHours: number
}

export type MaintenanceReportRow = {
  id: string
  client_name: string
  site_location: string
  technician_name: string
  inspection_date: string
  status: string
  total_doors: number
  checklist_summary: string
  issues_preview: string
  attachment_count: number
}

export type GpsReportRow = {
  id: string
  entry_date: string
  technician_name: string
  start_address: string
  end_address: string
  /** Parsed from gps_start / gps_end JSON for directions links */
  start_lat: number | null
  start_lng: number | null
  end_lat: number | null
  end_lng: number | null
  /** Only when internal mode */
  start_coords: string | null
  end_coords: string | null
}

export type QuotesReportSummary = {
  serviceQuotesCount: number
  serviceQuotesTotal: number
  pvcQuotesCount: number
  pvcQuotesTotal: number
  /** Schema has no approval flag — exposed as pipeline value */
  pipelineNote: string
}

export type QuoteTrendRow = {
  period: string
  service_total: number
  pvc_total: number
}

/** Line items for exports (service quotes table) */
export type QuoteServiceLine = {
  id: string
  quoteNumber: string
  customerName: string
  total: number
  createdAtLabel: string
}

/** Line items for exports (PVC estimates table) */
export type QuotePvcLine = {
  id: string
  finalPrice: number
  createdAtLabel: string
}

export type FilterOptions = {
  clients: Array<{ id: string; name: string }>
  technicians: Array<{ id: string; name: string }>
  locations: Array<{ id: string; label: string; client_id: string | null }>
  workTypesLevel1: Array<{ id: string; code: string; name: string }>
}
