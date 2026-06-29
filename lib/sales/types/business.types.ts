import type { SalesBusinessStatus } from '@/lib/sales/constants/businessStatuses'
import type { SalesBusinessSource } from '@/lib/sales/types/sources'
import type { SalesScanRun } from '@/lib/sales/types/scanRun.types'

export type { SalesBusinessStatus } from '@/lib/sales/constants/businessStatuses'
export { SALES_BUSINESS_STATUSES } from '@/lib/sales/constants/businessStatuses'

export type BusinessResult = {
  company_name: string
  address: string
  suburb: string
  postcode: string
  website: string | null
  phone: string | null
  category: string
  source: SalesBusinessSource
  raw_payload: Record<string, unknown>
}

export type SalesBusiness = {
  id: string
  scan_run_id: string | null
  company_name: string
  address: string | null
  suburb: string | null
  postcode: string
  website: string | null
  phone: string | null
  category: string | null
  source: SalesBusinessSource
  status: SalesBusinessStatus
  selected: boolean
  last_contacted_at: string | null
  contact_attempts: number
  raw_payload: Record<string, unknown> | null
  created_at: string
}

export type SalesBusinessInsert = {
  scan_run_id: string
  company_name: string
  address: string
  suburb: string
  postcode: string
  website: string | null
  phone: string | null
  category: string
  source: SalesBusinessSource
  status?: SalesBusinessStatus
  selected?: boolean
  last_contacted_at?: string | null
  contact_attempts?: number
  raw_payload?: Record<string, unknown> | null
}

export type SalesBusinessListResult = {
  rows: SalesBusiness[]
  total: number
  page: number
  pageSize: number
}

export type SalesBusinessSummary = {
  total: number
  selected: number
}

export type BusinessDiscoveryAgentResult = {
  inserted: number
  skipped: number
  scan_runs: SalesScanRun[]
  businesses: SalesBusiness[]
}

/** @deprecated Use BusinessDiscoveryAgentResult */
export type DiscoveryScanResult = BusinessDiscoveryAgentResult
