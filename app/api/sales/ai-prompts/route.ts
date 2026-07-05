import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  activateSalesAiPrompt,
  buildSalesAiPromptInsert,
  createSalesAiPrompt,
  getNextSalesAiPromptVersion,
  getSalesAiPromptById,
  listSalesAiPrompts,
  updateSalesAiPromptDefinition,
} from '@/lib/sales/repositories/salesAiPromptRepository'
import {
  createSalesAiPromptBodySchema,
  salesAiPromptListQuerySchema,
} from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'
import { buildPromptNameKey } from '@/lib/sales/types/aiPrompt.types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = salesAiPromptListQuerySchema.parse({
      productSlug: searchParams.get('productSlug') ?? undefined,
      industrySlug: searchParams.get('industrySlug') ?? undefined,
      useCaseSlug: searchParams.get('useCaseSlug') ?? undefined,
      campaignTypeId: searchParams.get('campaignTypeId') ?? undefined,
      activeOnly: searchParams.get('activeOnly') ?? undefined,
      promptName: searchParams.get('promptName') ?? undefined,
    })
    const prompts = await listSalesAiPrompts(auth.supabase, {
      productSlug: parsed.productSlug,
      industrySlug: parsed.industrySlug,
      useCaseSlug: parsed.useCaseSlug,
      campaignTypeId: parsed.campaignTypeId,
      activeOnly: parsed.activeOnly,
      promptName: parsed.promptName,
    })
    return ok({ prompts })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    return fail(error instanceof Error ? error.message : 'Failed to list prompts', 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 131_072)
    const body = await request.json()
    const parsed = createSalesAiPromptBodySchema.parse(body)
    const promptName = buildPromptNameKey({
      product_slug: parsed.productSlug,
      industry_slug: parsed.industrySlug,
      use_case_slug: parsed.useCaseSlug,
    })
    const version = await getNextSalesAiPromptVersion(auth.supabase, promptName)
    const insert = buildSalesAiPromptInsert({
      product_slug: parsed.productSlug,
      industry_slug: parsed.industrySlug,
      use_case_slug: parsed.useCaseSlug,
      campaign_type_id: parsed.campaignTypeId ?? null,
      definition: parsed.definition,
      version,
      created_by: auth.userId,
      activate: parsed.activate,
    })
    let prompt = await createSalesAiPrompt(auth.supabase, insert)
    if (parsed.activate) {
      prompt = await activateSalesAiPrompt(auth.supabase, prompt.id)
    }
    return ok({ prompt })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    return fail(error instanceof Error ? error.message : 'Failed to create prompt', 500)
  }
}
