import type { SalesContactScanStatus } from '@/lib/sales/constants/contactScanStatuses'

export type SalesContactScanLog = {
  id: string
  business_id: string
  website: string
  status: SalesContactScanStatus
  emails_found: number
  scanned_pages: number
  error_message: string | null
  created_at: string
}

export type SalesContactScanLogInsert = {
  business_id: string
  website: string
  status: SalesContactScanStatus
  emails_found?: number
  scanned_pages?: number
  error_message?: string | null
}
