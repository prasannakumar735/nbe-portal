import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { listSalesOfferTypes } from '@/lib/sales/repositories/salesOfferTypeRepository'
import { salesCampaignCatalogQuerySchema } from '@/lib/sales/validators/campaign.validators'



export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = salesCampaignCatalogQuerySchema.parse({
      activeOnly: searchParams.get('activeOnly') ?? undefined,
    })
    const types = await listSalesOfferTypes(auth.supabase, {
      activeOnly: parsed.activeOnly,
    })
    return ok({ types })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load offer types', 500)
  }
}
