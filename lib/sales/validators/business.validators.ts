import { z } from 'zod'
import { SALES_BUSINESS_STATUSES } from '@/lib/sales/constants/businessStatuses'
import { SALES_BUSINESS_SOURCES } from '@/lib/sales/types/sources'

export const salesBusinessStatusSchema = z.enum(SALES_BUSINESS_STATUSES)
export const salesBusinessSourceSchema = z.enum(SALES_BUSINESS_SOURCES)

export const salesBusinessSelectedPatchSchema = z.object({
  selected: z.boolean(),
})

export const salesBusinessStatusPatchSchema = z.object({
  status: salesBusinessStatusSchema,
})

export const salesBusinessListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  scanRunId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
})

export const salesBusinessSummaryQuerySchema = z.object({
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
})
