import { z } from 'zod'
import { SALES_CONTACT_SCAN_STATUSES } from '@/lib/sales/constants/contactScanStatuses'

export const salesContactScanStatusSchema = z.enum(SALES_CONTACT_SCAN_STATUSES)

export const salesContactScanLogInsertSchema = z.object({
  business_id: z.string().uuid(),
  website: z.string().trim().min(1).max(2048),
  status: salesContactScanStatusSchema,
  emails_found: z.number().int().min(0).optional(),
  scanned_pages: z.number().int().min(0).optional(),
  error_message: z.string().trim().max(4000).nullable().optional(),
})

export const salesContactScanLogCompleteSchema = z.object({
  emails_found: z.number().int().min(0),
  scanned_pages: z.number().int().min(0),
})

export const salesContactScanLogFailSchema = z.object({
  error_message: z.string().trim().min(1).max(4000),
})
