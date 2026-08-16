import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  activateSalesAiPrompt,
  buildSalesAiPromptInsert,
  createSalesAiPrompt,
  getNextSalesAiPromptVersion,
  listSalesAiPrompts,
  SalesAiPromptActivationConflictError,
  SalesAiPromptValidationError,
} from '@/lib/sales/repositories/salesAiPromptRepository'
import {
  createSalesAiPromptBodySchema,
  salesAiPromptListQuerySchema,
} from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'
import { buildPromptNameKey } from '@/lib/sales/types/aiPrompt.types'
import { formatPromptDescriptionLabel, formatResolvedPromptLabel } from '@/lib/sales/prompts/promptLabels'
import { validateSalesAiPromptForActivation } from '@/lib/sales/prompts/promptValidation'

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

    if (parsed.activate) {
      const validation = validateSalesAiPromptForActivation(parsed.definition)
      if (!validation.ok) {
        return fail(
          `Prompt is incomplete and cannot be activated:\n- ${validation.errors.join('\n- ')}`,
          422,
          { code: 'VALIDATION_FAILED', errors: validation.errors },
        )
      }
    }

    const promptName = buildPromptNameKey({
      product_slug: parsed.productSlug,
      industry_slug: parsed.industrySlug,
      use_case_slug: parsed.useCaseSlug,
    })
    const version = await getNextSalesAiPromptVersion(auth.supabase, promptName)
    const description =
      parsed.description?.trim() ||
      formatPromptDescriptionLabel({
        productSlug: parsed.productSlug,
        industrySlug: parsed.industrySlug,
        useCaseSlug: parsed.useCaseSlug,
      })

    // Always insert inactive; activation is explicit and may require confirmReplace.
    const insert = buildSalesAiPromptInsert({
      product_slug: parsed.productSlug,
      industry_slug: parsed.industrySlug,
      use_case_slug: parsed.useCaseSlug,
      campaign_type_id: parsed.campaignTypeId ?? null,
      description,
      definition: parsed.definition,
      version,
      created_by: auth.userId,
      activate: false,
    })
    let prompt = await createSalesAiPrompt(auth.supabase, insert)
    if (parsed.activate) {
      try {
        prompt = await activateSalesAiPrompt(auth.supabase, prompt.id, {
          confirmReplace: parsed.confirmReplace,
        })
      } catch (error) {
        if (error instanceof SalesAiPromptValidationError) {
          return fail(error.message, 422, {
            code: error.code,
            errors: error.errors,
            pendingPromptId: prompt.id,
          })
        }
        if (error instanceof SalesAiPromptActivationConflictError) {
          const current = error.currentActive
          return fail(error.message, 409, {
            code: error.code,
            pendingPromptId: prompt.id,
            currentActive: {
              id: current.id,
              version: current.version,
              description: current.description,
              label: formatResolvedPromptLabel({
                productSlug: current.product_slug,
                industrySlug: current.industry_slug,
                useCaseSlug: current.use_case_slug,
                version: current.version,
              }),
            },
          })
        }
        throw error
      }
    }
    return ok({ prompt })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    if (error instanceof SalesAiPromptValidationError) {
      return fail(error.message, 422, { code: error.code, errors: error.errors })
    }
    if (error instanceof SalesAiPromptActivationConflictError) {
      const current = error.currentActive
      return fail(error.message, 409, {
        code: error.code,
        currentActive: {
          id: current.id,
          version: current.version,
          description: current.description,
          label: formatResolvedPromptLabel({
            productSlug: current.product_slug,
            industrySlug: current.industry_slug,
            useCaseSlug: current.use_case_slug,
            version: current.version,
          }),
        },
      })
    }
    return fail(error instanceof Error ? error.message : 'Failed to create prompt', 500)
  }
}
