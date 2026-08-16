export const SALES_CONTACT_VERIFICATION_STATUSES = [
  'unknown',
  'valid',
  'invalid',
  'bounced',
  'blocked',
] as const

export type SalesContactVerificationStatus = (typeof SALES_CONTACT_VERIFICATION_STATUSES)[number]
