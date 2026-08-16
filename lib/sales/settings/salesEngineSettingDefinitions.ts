import { SALES_ENGINE_SETTING_KEYS } from '@/lib/sales/constants/salesEngineSettingKeys'
import type {
  SalesEngineDeliverabilityAuthStatus,
  SalesEngineSettingDefinition,
} from '@/lib/sales/types/salesEngineSettings.types'

export const SALES_ENGINE_DELIVERABILITY_AUTH_STATUSES: readonly SalesEngineDeliverabilityAuthStatus[] =
  ['unknown', 'pass', 'fail', 'not_configured']

export const SALES_ENGINE_SETTING_DEFINITIONS: readonly SalesEngineSettingDefinition[] = [
  {
    key: SALES_ENGINE_SETTING_KEYS.SALES_ENGINE_ENABLED,
    label: 'Sales Engine enabled',
    description: 'Master switch for Sales Engine features.',
    group: 'general',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.CAMPAIGN_SENDING_ENABLED,
    label: 'Campaign sending enabled',
    description: 'When disabled, outbound queue dispatch skips sends (approval and queue unchanged).',
    group: 'feature_flags',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.SAFE_DELIVERY_ENABLED,
    label: 'Safe Delivery Mode (pilot)',
    description: 'Redirect all outbound sends to the testing email; original recipient is logged.',
    group: 'feature_flags',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.SAFE_DELIVERY_REDIRECT_EMAIL,
    label: 'Safe Delivery redirect email',
    description: 'Required when Safe Delivery Mode is enabled.',
    group: 'safe_delivery',
    valueType: 'string',
    defaultValue: '',
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.AI_REPLY_ANALYSIS_ENABLED,
    label: 'AI reply analysis',
    description: 'Run LLM analysis on inbound customer replies.',
    group: 'feature_flags',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.AI_REPLY_DRAFT_GENERATION_ENABLED,
    label: 'AI reply draft generation',
    description: 'Future: automatic reply drafts (not customer-facing send).',
    group: 'feature_flags',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.EMAIL_TRACKING_ENABLED,
    label: 'Email tracking',
    description: 'Engagement and delivery tracking for outbound mail.',
    group: 'feature_flags',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.ATTACHMENT_SENDING_ENABLED,
    label: 'Attachment sending',
    description: 'Include offer brochures and generated-email attachments on send.',
    group: 'feature_flags',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.CRM_INTEGRATION_ENABLED,
    label: 'Future CRM integration',
    description: 'Placeholder for future CRM sync features.',
    group: 'feature_flags',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_BUSINESS_HOURS_ONLY,
    label: 'Business hours sending only',
    description: 'Future: restrict dispatch to configured business hours.',
    group: 'deliverability',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_MAX_EMAILS_PER_HOUR,
    label: 'Max emails per hour',
    description: 'Future: hourly cap (null = use server default).',
    group: 'deliverability',
    valueType: 'number',
    defaultValue: null,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_MAX_EMAILS_PER_DAY,
    label: 'Max emails per day',
    description: 'Future: daily cap (null = no daily cap).',
    group: 'deliverability',
    valueType: 'number',
    defaultValue: null,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_RANDOM_SEND_DELAY_MS,
    label: 'Random send delay (ms)',
    description: 'Future: jitter between sends (0 = none).',
    group: 'deliverability',
    valueType: 'number',
    defaultValue: 0,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_SPF_STATUS,
    label: 'SPF status',
    description: 'Manual record for admin visibility.',
    group: 'deliverability',
    valueType: 'string',
    defaultValue: 'unknown',
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_DKIM_STATUS,
    label: 'DKIM status',
    description: 'Manual record for admin visibility.',
    group: 'deliverability',
    valueType: 'string',
    defaultValue: 'unknown',
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_DMARC_STATUS,
    label: 'DMARC status',
    description: 'Manual record for admin visibility.',
    group: 'deliverability',
    valueType: 'string',
    defaultValue: 'unknown',
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_TLS_STATUS,
    label: 'TLS status',
    description: 'Manual record for admin visibility.',
    group: 'deliverability',
    valueType: 'string',
    defaultValue: 'unknown',
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_FUTURE_SPAM_SCORE,
    label: 'Future spam score',
    description: 'Reserved for future deliverability monitoring.',
    group: 'deliverability',
    valueType: 'json',
    defaultValue: null,
  },
  {
    key: SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_FUTURE_DOMAIN_REPUTATION,
    label: 'Future domain reputation',
    description: 'Reserved for future deliverability monitoring.',
    group: 'deliverability',
    valueType: 'json',
    defaultValue: null,
  },
]

const definitionByKey = new Map(
  SALES_ENGINE_SETTING_DEFINITIONS.map((d) => [d.key, d] as const),
)

export function getSalesEngineSettingDefinition(
  key: string,
): SalesEngineSettingDefinition | undefined {
  return definitionByKey.get(key as SalesEngineSettingDefinition['key'])
}

export function getDefaultSalesEngineSettingValues(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const def of SALES_ENGINE_SETTING_DEFINITIONS) {
    out[def.key] = def.defaultValue
  }
  return out
}
