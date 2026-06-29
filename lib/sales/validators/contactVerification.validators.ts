import { z } from 'zod'
import { SALES_CONTACT_VERIFICATION_STATUSES } from '@/lib/sales/constants/contactVerification'

export const salesContactVerificationStatusSchema = z.enum(SALES_CONTACT_VERIFICATION_STATUSES)

export const salesContactVerificationPatchSchema = z.object({
  email_verified: z.boolean(),
  verification_status: salesContactVerificationStatusSchema,
})
