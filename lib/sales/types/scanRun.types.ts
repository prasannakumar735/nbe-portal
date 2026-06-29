export const SALES_SCAN_RUN_STATUSES = ['running', 'completed', 'failed'] as const
export type SalesScanRunStatus = (typeof SALES_SCAN_RUN_STATUSES)[number]

export type SalesScanRun = {
  id: string
  postcode: string
  status: SalesScanRunStatus
  started_at: string | null
  completed_at: string | null
  total_found: number
  created_by: string | null
  created_at: string
}

export type SalesScanRunInsert = {
  postcode: string
  status: SalesScanRunStatus
  started_at?: string | null
  completed_at?: string | null
  total_found?: number
  created_by?: string | null
}
