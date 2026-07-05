import { SALES_INDUSTRY_LABELS, type SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import {
  SALES_PRODUCT_LINE_LABELS,
  type SalesProductLineSlug,
} from '@/lib/sales/constants/productLineSlugs'
import {
  SALES_PROMPT_USE_CASE_LABELS,
  type SalesPromptUseCaseSlug,
} from '@/lib/sales/constants/useCaseSlugs'

/** Manager-facing slot label (no internal slugs). */
export function formatPromptSlotLabel(input: {
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
}): string {
  return [
    SALES_PRODUCT_LINE_LABELS[input.productSlug],
    SALES_INDUSTRY_LABELS[input.industrySlug],
    SALES_PROMPT_USE_CASE_LABELS[input.useCaseSlug],
  ].join(' – ')
}

/** Manager-facing resolved prompt label including version. */
export function formatResolvedPromptLabel(input: {
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
  version: number
}): string {
  return `${formatPromptSlotLabel(input)} V${input.version}`
}

/** Default seed / publish description for managers. */
export function formatPromptDescriptionLabel(input: {
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
}): string {
  return formatPromptSlotLabel(input)
}
