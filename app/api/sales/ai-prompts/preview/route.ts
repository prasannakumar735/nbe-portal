import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { buildPromptPreview } from '@/lib/sales/prompts/promptPreviewService'
import { salesAiPromptPreviewQuerySchema } from '@/lib/sales/validators'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = salesAiPromptPreviewQuerySchema.parse({
      campaignId: searchParams.get('campaignId') ?? undefined,
      campaignTypeId: searchParams.get('campaignTypeId') ?? undefined,
      productSlug: searchParams.get('productSlug') ?? undefined,
      industrySlug: searchParams.get('industrySlug') ?? undefined,
      useCaseSlug: searchParams.get('useCaseSlug') ?? undefined,
      contactId: searchParams.get('contactId') ?? undefined,
      businessCategory: searchParams.get('businessCategory') ?? undefined,
    })
    const preview = await buildPromptPreview(auth.supabase, parsed)
    return ok({ preview })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    return fail(error instanceof Error ? error.message : 'Preview failed', 500)
  }
}
