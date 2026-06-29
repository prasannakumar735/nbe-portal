export const SALES_CONTACT_SCAN_STATUSES = ['running', 'completed', 'failed'] as const

export type SalesContactScanStatus = (typeof SALES_CONTACT_SCAN_STATUSES)[number]
