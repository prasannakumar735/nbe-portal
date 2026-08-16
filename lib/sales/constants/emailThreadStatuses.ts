/** Email thread lifecycle (Phase 10.5 — manual transitions only). */
export const SALES_EMAIL_THREAD_STATUSES = [
  'open',
  'waiting_manager',
  'waiting_customer',
  'closed',
] as const

export type SalesEmailThreadStatus = (typeof SALES_EMAIL_THREAD_STATUSES)[number]

export function isSalesEmailThreadStatus(value: string): value is SalesEmailThreadStatus {
  return (SALES_EMAIL_THREAD_STATUSES as readonly string[]).includes(value)
}
