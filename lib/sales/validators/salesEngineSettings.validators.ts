import { z } from 'zod'
import type { SalesEngineSettingKey } from '@/lib/sales/constants/salesEngineSettingKeys'
import {
  SALES_ENGINE_DELIVERABILITY_AUTH_STATUSES,
  SALES_ENGINE_SETTING_DEFINITIONS,
  getSalesEngineSettingDefinition,
} from '@/lib/sales/settings/salesEngineSettingDefinitions'
import { ALL_SALES_ENGINE_SETTING_KEYS } from '@/lib/sales/constants/salesEngineSettingKeys'

const knownSettingKeySchema = z
  .string()
  .refine((k): k is SalesEngineSettingKey => ALL_SALES_ENGINE_SETTING_KEYS.includes(k as SalesEngineSettingKey), {
    message: 'Unknown setting key',
  })

const authStatusSchema = z.enum(
  SALES_ENGINE_DELIVERABILITY_AUTH_STATUSES as unknown as [string, ...string[]],
)

function schemaForKey(key: string): z.ZodType<unknown> {
  const def = getSalesEngineSettingDefinition(key)
  if (!def) {
    throw new Error(`Unknown setting key: ${key}`)
  }
  switch (def.valueType) {
    case 'boolean':
      return z.boolean()
    case 'string':
      if (
        key === 'deliverability.spf_status' ||
        key === 'deliverability.dkim_status' ||
        key === 'deliverability.dmarc_status' ||
        key === 'deliverability.tls_status'
      ) {
        return authStatusSchema
      }
      return z.string().max(500)
    case 'number':
      return z.number().finite().min(0).nullable()
    case 'json':
      return z.unknown().nullable()
    default:
      return z.unknown()
  }
}

const patchEntrySchema = z
  .object({
    key: knownSettingKeySchema,
    value: z.unknown(),
  })
  .superRefine((entry, ctx) => {
    try {
      const schema = schemaForKey(entry.key)
      const parsed = schema.safeParse(entry.value)
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid value',
          path: ['value'],
        })
      }
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : 'Invalid key',
        path: ['key'],
      })
    }
  })

export const salesEngineSettingsPatchBodySchema = z.object({
  settings: z.array(patchEntrySchema).min(1).max(SALES_ENGINE_SETTING_DEFINITIONS.length),
})

export type SalesEngineSettingsPatchBody = z.infer<typeof salesEngineSettingsPatchBodySchema>

/** Cross-field: safe delivery requires valid redirect when enabled. */
export function validateSafeDeliveryPatch(
  settings: { key: string; value: unknown }[],
): string | null {
  const byKey = new Map(settings.map((s) => [s.key, s.value]))
  const enabled = byKey.get('safe_delivery.enabled')
  const redirect = byKey.get('safe_delivery.redirect_email')
  const effectiveEnabled = typeof enabled === 'boolean' ? enabled : undefined
  const effectiveRedirect = typeof redirect === 'string' ? redirect.trim() : undefined

  if (effectiveEnabled === true) {
    const email = effectiveRedirect ?? ''
    if (!z.string().email().safeParse(email).success) {
      return 'Safe Delivery Mode requires a valid redirect email.'
    }
  }
  return null
}
