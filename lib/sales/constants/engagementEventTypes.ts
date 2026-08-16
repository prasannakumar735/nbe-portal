export const SALES_ENGAGEMENT_EVENT_TYPES = [
  'delivered',
  'opened',
  'clicked',
  'replied',
  'bounced',
  'unsubscribed',
] as const

export type SalesEngagementEventType = (typeof SALES_ENGAGEMENT_EVENT_TYPES)[number]

export const SALES_ENGAGEMENT_EVENT_SOURCES = [
  'api',
  'delivery_log',
  'tracking_pixel',
  'tracking_link',
  'unsubscribe_link',
  'system',
] as const

export type SalesEngagementEventSource = (typeof SALES_ENGAGEMENT_EVENT_SOURCES)[number]

export function isSalesEngagementEventType(value: string): value is SalesEngagementEventType {
  return (SALES_ENGAGEMENT_EVENT_TYPES as readonly string[]).includes(value)
}
