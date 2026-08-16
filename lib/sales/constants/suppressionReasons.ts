/** Why an address is on the do-not-email list. */

export const SALES_EMAIL_SUPPRESSION_REASONS = [
  'unsubscribed',
  'bounced',
  'complained',
  'manual',
] as const

export type SalesEmailSuppressionReason = (typeof SALES_EMAIL_SUPPRESSION_REASONS)[number]

export function isSalesEmailSuppressionReason(
  value: string,
): value is SalesEmailSuppressionReason {
  return (SALES_EMAIL_SUPPRESSION_REASONS as readonly string[]).includes(value)
}
