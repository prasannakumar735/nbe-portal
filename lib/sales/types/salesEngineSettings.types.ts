import type { SalesEngineSettingKey } from '@/lib/sales/constants/salesEngineSettingKeys'

export type SalesEngineSettingValueType = 'boolean' | 'string' | 'number' | 'json'

export type SalesEngineSettingGroup =
  | 'general'
  | 'feature_flags'
  | 'safe_delivery'
  | 'deliverability'
  | 'ai'

export type SalesEngineDeliverabilityAuthStatus =
  | 'unknown'
  | 'pass'
  | 'fail'
  | 'not_configured'

export type SalesEngineSettingDefinition = {
  key: SalesEngineSettingKey
  label: string
  description: string
  group: SalesEngineSettingGroup
  valueType: SalesEngineSettingValueType
  defaultValue: boolean | string | number | null | Record<string, unknown>
}

export type SalesEngineSettingRow = {
  key: string
  value: unknown
  updated_at: string
  updated_by: string | null
}

/** Resolved runtime snapshot (defaults merged with DB). */
export type SalesEngineSettings = {
  salesEngineEnabled: boolean
  campaignSendingEnabled: boolean
  safeDeliveryEnabled: boolean
  safeDeliveryRedirectEmail: string
  aiReplyAnalysisEnabled: boolean
  aiReplyDraftGenerationEnabled: boolean
  emailTrackingEnabled: boolean
  attachmentSendingEnabled: boolean
  crmIntegrationEnabled: boolean
  deliverabilityBusinessHoursOnly: boolean
  deliverabilityMaxEmailsPerHour: number | null
  deliverabilityMaxEmailsPerDay: number | null
  deliverabilityRandomSendDelayMs: number
  deliverabilitySpfStatus: SalesEngineDeliverabilityAuthStatus
  deliverabilityDkimStatus: SalesEngineDeliverabilityAuthStatus
  deliverabilityDmarcStatus: SalesEngineDeliverabilityAuthStatus
  deliverabilityTlsStatus: SalesEngineDeliverabilityAuthStatus
  deliverabilityFutureSpamScore: unknown
  deliverabilityFutureDomainReputation: unknown
}

export type ResolvedOutboundRecipient = {
  intendedRecipient: string
  actualRecipient: string
  safeDeliveryActive: boolean
}

export type SalesEngineSettingsPatch = Partial<Record<SalesEngineSettingKey, unknown>>
