/** Stable keys for `sales_engine_settings` — single source of truth for application code. */
export const SALES_ENGINE_SETTING_KEYS = {
  SALES_ENGINE_ENABLED: 'sales_engine.enabled',
  CAMPAIGN_SENDING_ENABLED: 'campaign_sending.enabled',
  SAFE_DELIVERY_ENABLED: 'safe_delivery.enabled',
  SAFE_DELIVERY_REDIRECT_EMAIL: 'safe_delivery.redirect_email',
  AI_REPLY_ANALYSIS_ENABLED: 'ai_reply_analysis.enabled',
  AI_REPLY_DRAFT_GENERATION_ENABLED: 'ai_reply_draft_generation.enabled',
  EMAIL_TRACKING_ENABLED: 'email_tracking.enabled',
  ATTACHMENT_SENDING_ENABLED: 'attachment_sending.enabled',
  CRM_INTEGRATION_ENABLED: 'crm_integration.enabled',
  DELIVERABILITY_BUSINESS_HOURS_ONLY: 'deliverability.business_hours_only',
  DELIVERABILITY_MAX_EMAILS_PER_HOUR: 'deliverability.max_emails_per_hour',
  DELIVERABILITY_MAX_EMAILS_PER_DAY: 'deliverability.max_emails_per_day',
  DELIVERABILITY_RANDOM_SEND_DELAY_MS: 'deliverability.random_send_delay_ms',
  DELIVERABILITY_SPF_STATUS: 'deliverability.spf_status',
  DELIVERABILITY_DKIM_STATUS: 'deliverability.dkim_status',
  DELIVERABILITY_DMARC_STATUS: 'deliverability.dmarc_status',
  DELIVERABILITY_TLS_STATUS: 'deliverability.tls_status',
  DELIVERABILITY_FUTURE_SPAM_SCORE: 'deliverability.future_spam_score',
  DELIVERABILITY_FUTURE_DOMAIN_REPUTATION: 'deliverability.future_domain_reputation',
} as const

export type SalesEngineSettingKey =
  (typeof SALES_ENGINE_SETTING_KEYS)[keyof typeof SALES_ENGINE_SETTING_KEYS]

export const ALL_SALES_ENGINE_SETTING_KEYS: readonly SalesEngineSettingKey[] = Object.values(
  SALES_ENGINE_SETTING_KEYS,
)
