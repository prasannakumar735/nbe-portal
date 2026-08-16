import { ZodError } from 'zod'
import {
  fail,
  ok,
  requireAdminApi,
  requireManagerOrAdminApi,
} from '@/app/api/admin/_utils'
import {
  applySalesEngineSettingsPatch,
  getSalesEngineAdminSettingsPayload,
} from '@/lib/sales/settings/salesEngineAdminSettingsService'
import {
  salesEngineSettingsPatchBodySchema,
  validateSafeDeliveryPatch,
} from '@/lib/sales/validators/salesEngineSettings.validators'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const payload = await getSalesEngineAdminSettingsPayload(auth.supabase)
    return ok(payload)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load settings', 500)
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = salesEngineSettingsPatchBodySchema.parse(body)

    const rows = await getSalesEngineAdminSettingsPayload(auth.supabase)
    const mergedValues = { ...rows.values }
    for (const patch of parsed.settings) {
      mergedValues[patch.key] = patch.value
    }

    const safeDeliveryError = validateSafeDeliveryPatch(
      Object.entries(mergedValues).map(([key, value]) => ({ key, value })),
    )
    if (safeDeliveryError) {
      return fail(safeDeliveryError, 422)
    }

    const payload = await applySalesEngineSettingsPatch(
      auth.supabase,
      parsed.settings,
      auth.userId,
    )
    return ok(payload)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update settings', 500)
  }
}
