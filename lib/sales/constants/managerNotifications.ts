export const SALES_MANAGER_NOTIFICATION_TYPES = [
  'customer_replied',
  'quote_requested',
  'inspection_requested',
  'unsubscribe',
  'analysis_failed',
  'urgent_customer_response',
] as const

export type SalesManagerNotificationType = (typeof SALES_MANAGER_NOTIFICATION_TYPES)[number]

export const SALES_MANAGER_NOTIFICATION_PRIORITIES = ['high', 'medium', 'low'] as const

export type SalesManagerNotificationPriority = (typeof SALES_MANAGER_NOTIFICATION_PRIORITIES)[number]

/** UI sorting hint only — does not change notification creation rules in Phase 10.5. */
export const SALES_REPLY_CATEGORY_NOTIFICATION_PRIORITY: Record<
  string,
  SalesManagerNotificationPriority
> = {
  needs_quote: 'high',
  wants_site_inspection: 'high',
  urgent_customer_response: 'high',
  interested: 'medium',
  technical_question: 'medium',
  pricing_question: 'medium',
  wrong_contact: 'low',
  existing_customer: 'low',
  unsubscribe: 'low',
  not_interested: 'low',
  analysis_failed: 'low',
}
