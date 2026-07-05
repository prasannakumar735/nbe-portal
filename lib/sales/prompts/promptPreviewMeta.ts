import { SALES_INDUSTRY_LABELS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS } from '@/lib/sales/constants/productLineSlugs'
import { SALES_PROMPT_USE_CASE_LABELS } from '@/lib/sales/constants/useCaseSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { formatResolvedPromptLabel } from '@/lib/sales/prompts/promptLabels'

export type PromptPreviewMeta = {
  promptName: string
  promptVersion: number
  promptLibraryId: string
  promptDescription: string | null
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
  productLabel: string
  industryLabel: string
  useCaseLabel: string
  resolvedLabel: string
  resolutionPath: string[]
}

export function buildPromptPreviewMeta(input: {
  promptName: string
  promptVersion: number
  promptLibraryId: string
  promptDescription: string | null
  productSlug: string
  industrySlug: string
  useCaseSlug: string
  resolutionPath: string[]
}): PromptPreviewMeta {
  const productSlug = input.productSlug as SalesProductLineSlug
  const industrySlug = input.industrySlug as SalesIndustrySlug
  const useCaseSlug = input.useCaseSlug as SalesPromptUseCaseSlug
  return {
    promptName: input.promptName,
    promptVersion: input.promptVersion,
    promptLibraryId: input.promptLibraryId,
    promptDescription: input.promptDescription,
    productSlug,
    industrySlug,
    useCaseSlug,
    productLabel: SALES_PRODUCT_LINE_LABELS[productSlug] ?? input.productSlug,
    industryLabel: SALES_INDUSTRY_LABELS[industrySlug] ?? input.industrySlug,
    useCaseLabel: SALES_PROMPT_USE_CASE_LABELS[useCaseSlug] ?? input.useCaseSlug,
    resolvedLabel: formatResolvedPromptLabel({
      productSlug,
      industrySlug,
      useCaseSlug,
      version: input.promptVersion,
    }),
    resolutionPath: input.resolutionPath,
  }
}
