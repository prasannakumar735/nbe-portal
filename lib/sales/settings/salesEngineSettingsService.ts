import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { SalesEngineSettingKey } from '@/lib/sales/constants/salesEngineSettingKeys'
import { ALL_SALES_ENGINE_SETTING_KEYS } from '@/lib/sales/constants/salesEngineSettingKeys'
import {
  SALES_ENGINE_DELIVERABILITY_AUTH_STATUSES,
  SALES_ENGINE_SETTING_DEFINITIONS,
  getSalesEngineSettingDefinition,
} from '@/lib/sales/settings/salesEngineSettingDefinitions'
import type {
  ResolvedOutboundRecipient,
  SalesEngineDeliverabilityAuthStatus,
  SalesEngineSettings,
  SalesEngineSettingRow,
} from '@/lib/sales/types/salesEngineSettings.types'
import { listSalesEngineSettings } from '@/lib/sales/repositories/salesEngineSettingsRepository'
import { SALES_ENGINE_SETTING_KEYS } from '@/lib/sales/constants/salesEngineSettingKeys'

const CACHE_TTL_MS = 45_000

type CacheEntry = {
  expiresAt: number
  settings: SalesEngineSettings
}

let settingsCache: CacheEntry | null = null

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  return String(value)
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asAuthStatus(value: unknown): SalesEngineDeliverabilityAuthStatus {
  const s = asString(value, 'unknown')
  return SALES_ENGINE_DELIVERABILITY_AUTH_STATUSES.includes(s as SalesEngineDeliverabilityAuthStatus)
    ? (s as SalesEngineDeliverabilityAuthStatus)
    : 'unknown'
}

function mergeRawValues(rows: SalesEngineSettingRow[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const def of SALES_ENGINE_SETTING_DEFINITIONS) {
    merged[def.key] = def.defaultValue
  }
  for (const row of rows) {
    merged[row.key] = row.value
  }
  return merged
}

export function buildSalesEngineSettingsSnapshot(
  raw: Record<string, unknown>,
): SalesEngineSettings {
  return {
    salesEngineEnabled: asBoolean(raw[SALES_ENGINE_SETTING_KEYS.SALES_ENGINE_ENABLED], true),
    campaignSendingEnabled: asBoolean(raw[SALES_ENGINE_SETTING_KEYS.CAMPAIGN_SENDING_ENABLED], true),
    safeDeliveryEnabled: asBoolean(raw[SALES_ENGINE_SETTING_KEYS.SAFE_DELIVERY_ENABLED], false),
    safeDeliveryRedirectEmail: asString(
      raw[SALES_ENGINE_SETTING_KEYS.SAFE_DELIVERY_REDIRECT_EMAIL],
      '',
    ).trim(),
    aiReplyAnalysisEnabled: asBoolean(raw[SALES_ENGINE_SETTING_KEYS.AI_REPLY_ANALYSIS_ENABLED], true),
    aiReplyDraftGenerationEnabled: asBoolean(
      raw[SALES_ENGINE_SETTING_KEYS.AI_REPLY_DRAFT_GENERATION_ENABLED],
      false,
    ),
    emailTrackingEnabled: asBoolean(raw[SALES_ENGINE_SETTING_KEYS.EMAIL_TRACKING_ENABLED], true),
    attachmentSendingEnabled: asBoolean(
      raw[SALES_ENGINE_SETTING_KEYS.ATTACHMENT_SENDING_ENABLED],
      true,
    ),
    crmIntegrationEnabled: asBoolean(raw[SALES_ENGINE_SETTING_KEYS.CRM_INTEGRATION_ENABLED], false),
    deliverabilityBusinessHoursOnly: asBoolean(
      raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_BUSINESS_HOURS_ONLY],
      false,
    ),
    deliverabilityMaxEmailsPerHour: asNullableNumber(
      raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_MAX_EMAILS_PER_HOUR],
    ),
    deliverabilityMaxEmailsPerDay: asNullableNumber(
      raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_MAX_EMAILS_PER_DAY],
    ),
    deliverabilityRandomSendDelayMs: asNumber(
      raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_RANDOM_SEND_DELAY_MS],
      0,
    ),
    deliverabilitySpfStatus: asAuthStatus(raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_SPF_STATUS]),
    deliverabilityDkimStatus: asAuthStatus(
      raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_DKIM_STATUS],
    ),
    deliverabilityDmarcStatus: asAuthStatus(
      raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_DMARC_STATUS],
    ),
    deliverabilityTlsStatus: asAuthStatus(raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_TLS_STATUS]),
    deliverabilityFutureSpamScore: raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_FUTURE_SPAM_SCORE],
    deliverabilityFutureDomainReputation:
      raw[SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_FUTURE_DOMAIN_REPUTATION],
  }
}

export function invalidateSalesEngineSettingsCache(): void {
  settingsCache = null
}

export async function loadSalesEngineSettings(
  supabase: SupabaseClient,
): Promise<SalesEngineSettings> {
  const now = Date.now()
  if (settingsCache && settingsCache.expiresAt > now) {
    return settingsCache.settings
  }

  const rows = await listSalesEngineSettings(supabase)
  const snapshot = buildSalesEngineSettingsSnapshot(mergeRawValues(rows))
  settingsCache = { expiresAt: now + CACHE_TTL_MS, settings: snapshot }
  return snapshot
}

export function isFeatureEnabled(settings: SalesEngineSettings, key: SalesEngineSettingKey): boolean {
  switch (key) {
    case SALES_ENGINE_SETTING_KEYS.SALES_ENGINE_ENABLED:
      return settings.salesEngineEnabled
    case SALES_ENGINE_SETTING_KEYS.CAMPAIGN_SENDING_ENABLED:
      return settings.campaignSendingEnabled
    case SALES_ENGINE_SETTING_KEYS.SAFE_DELIVERY_ENABLED:
      return settings.safeDeliveryEnabled
    case SALES_ENGINE_SETTING_KEYS.AI_REPLY_ANALYSIS_ENABLED:
      return settings.aiReplyAnalysisEnabled
    case SALES_ENGINE_SETTING_KEYS.AI_REPLY_DRAFT_GENERATION_ENABLED:
      return settings.aiReplyDraftGenerationEnabled
    case SALES_ENGINE_SETTING_KEYS.EMAIL_TRACKING_ENABLED:
      return settings.emailTrackingEnabled
    case SALES_ENGINE_SETTING_KEYS.ATTACHMENT_SENDING_ENABLED:
      return settings.attachmentSendingEnabled
    case SALES_ENGINE_SETTING_KEYS.CRM_INTEGRATION_ENABLED:
      return settings.crmIntegrationEnabled
    case SALES_ENGINE_SETTING_KEYS.DELIVERABILITY_BUSINESS_HOURS_ONLY:
      return settings.deliverabilityBusinessHoursOnly
    default:
      return false
  }
}

const emailSchema = z.string().email()

export type ResolveOutboundRecipientResult =
  | { ok: true; resolved: ResolvedOutboundRecipient }
  | { ok: false; errorMessage: string }

export function resolveOutboundRecipient(
  settings: SalesEngineSettings,
  intendedEmail: string,
): ResolveOutboundRecipientResult {
  const intendedRecipient = intendedEmail.trim()
  if (!intendedRecipient) {
    return { ok: false, errorMessage: 'Contact has no email address.' }
  }

  if (!settings.safeDeliveryEnabled) {
    return {
      ok: true,
      resolved: {
        intendedRecipient,
        actualRecipient: intendedRecipient,
        safeDeliveryActive: false,
      },
    }
  }

  const redirect = settings.safeDeliveryRedirectEmail.trim()
  const parsed = emailSchema.safeParse(redirect)
  if (!parsed.success) {
    return {
      ok: false,
      errorMessage:
        'Safe Delivery Mode is enabled but redirect email is missing or invalid. Configure it in Sales Engine Administration.',
    }
  }

  return {
    ok: true,
    resolved: {
      intendedRecipient,
      actualRecipient: parsed.data,
      safeDeliveryActive: true,
    },
  }
}

export function getDeliverabilityConfig(settings: SalesEngineSettings) {
  return {
    businessHoursOnly: settings.deliverabilityBusinessHoursOnly,
    maxEmailsPerHour: settings.deliverabilityMaxEmailsPerHour,
    maxEmailsPerDay: settings.deliverabilityMaxEmailsPerDay,
    randomSendDelayMs: settings.deliverabilityRandomSendDelayMs,
    spfStatus: settings.deliverabilitySpfStatus,
    dkimStatus: settings.deliverabilityDkimStatus,
    dmarcStatus: settings.deliverabilityDmarcStatus,
    tlsStatus: settings.deliverabilityTlsStatus,
  }
}

export function getKnownSalesEngineSettingKeys(): readonly SalesEngineSettingKey[] {
  return ALL_SALES_ENGINE_SETTING_KEYS
}

export function assertKnownSettingKey(key: string): SalesEngineSettingKey {
  const def = getSalesEngineSettingDefinition(key)
  if (!def) {
    throw new Error(`Unknown Sales Engine setting key: ${key}`)
  }
  return def.key
}
