'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SalesEngineApiError,
  salesEngineFetch,
} from '@/components/sales-engine/salesEngineApi'
import { SALES_INDUSTRY_SLUGS, type SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import {
  SALES_PRODUCT_LINE_SLUGS,
  type SalesProductLineSlug,
} from '@/lib/sales/constants/productLineSlugs'
import {
  SALES_PROMPT_USE_CASE_SLUGS,
  type SalesPromptUseCaseSlug,
} from '@/lib/sales/constants/useCaseSlugs'
import type { SalesAiPrompt, SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'
import { EMPTY_SALES_AI_PROMPT_DEFINITION } from '@/lib/sales/types/aiPrompt.types'
import { formatPromptDescriptionLabel } from '@/lib/sales/prompts/promptLabels'
import { validateSalesAiPromptForActivation } from '@/lib/sales/prompts/promptValidation'

type ListResponse = { prompts: SalesAiPrompt[] }
type PromptResponse = { prompt: SalesAiPrompt }

export type PromptLibraryFormState = {
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
  description: string
  definition: SalesAiPromptDefinition
}

export type ActivationConflict = {
  id: string
  version: number
  description: string | null
  label: string
}

export type ActivationAttemptResult =
  | { status: 'ok'; prompt?: SalesAiPrompt }
  | { status: 'validation'; errors: string[]; pendingPromptId?: string }
  | {
      status: 'conflict'
      currentActive: ActivationConflict
      pendingPromptId?: string
    }
  | { status: 'error'; message: string }

export function defaultPromptLibraryForm(): PromptLibraryFormState {
  return {
    productSlug: SALES_PRODUCT_LINE_SLUGS[0],
    industrySlug: SALES_INDUSTRY_SLUGS[0],
    useCaseSlug: SALES_PROMPT_USE_CASE_SLUGS[0],
    description: '',
    definition: {
      ...EMPTY_SALES_AI_PROMPT_DEFINITION,
      target_audience: ['Operations manager', 'Facilities manager'],
      business_pain_points: ['Operational downtime', 'Compliance and safety requirements'],
      value_proposition: 'Practical industrial solutions with measurable operational benefit.',
      cta: 'Offer a brief site conversation to assess current setup.',
      subject_line_guidance: 'Professional, specific to operations; no hype.',
    },
  }
}

export function promptToForm(prompt: SalesAiPrompt): PromptLibraryFormState {
  return {
    productSlug: prompt.product_slug,
    industrySlug: prompt.industry_slug,
    useCaseSlug: prompt.use_case_slug,
    description: prompt.description ?? '',
    definition: { ...prompt.definition },
  }
}

function parseActivationError(error: unknown): ActivationAttemptResult {
  if (error instanceof SalesEngineApiError) {
    const issues = error.issues as
      | {
          code?: string
          errors?: string[]
          currentActive?: ActivationConflict
          pendingPromptId?: string
        }
      | undefined
    if (issues?.code === 'VALIDATION_FAILED' && issues.errors?.length) {
      return {
        status: 'validation',
        errors: issues.errors,
        pendingPromptId: issues.pendingPromptId,
      }
    }
    if (issues?.code === 'ACTIVE_PROMPT_EXISTS' && issues.currentActive) {
      return {
        status: 'conflict',
        currentActive: issues.currentActive,
        pendingPromptId: issues.pendingPromptId,
      }
    }
    return { status: 'error', message: error.message }
  }
  return {
    status: 'error',
    message: error instanceof Error ? error.message : 'Request failed',
  }
}

export function usePromptLibrary() {
  const [prompts, setPrompts] = useState<SalesAiPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [productFilter, setProductFilter] = useState<SalesProductLineSlug | ''>('')
  const [industryFilter, setIndustryFilter] = useState<SalesIndustrySlug | ''>('')
  const [useCaseFilter, setUseCaseFilter] = useState<SalesPromptUseCaseSlug | ''>('')
  const [activeOnly, setActiveOnly] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (productFilter) params.set('productSlug', productFilter)
      if (industryFilter) params.set('industrySlug', industryFilter)
      if (useCaseFilter) params.set('useCaseSlug', useCaseFilter)
      if (activeOnly) params.set('activeOnly', 'true')
      const qs = params.toString()
      const data = await salesEngineFetch<ListResponse>(
        `/api/sales/ai-prompts${qs ? `?${qs}` : ''}`,
      )
      setPrompts(data.prompts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prompts')
    } finally {
      setLoading(false)
    }
  }, [productFilter, industryFilter, useCaseFilter, activeOnly])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const publishVersion = useCallback(
    async (
      form: PromptLibraryFormState,
      activate: boolean,
      confirmReplace = false,
    ): Promise<ActivationAttemptResult> => {
      setValidationErrors([])
      setError(null)

      if (activate) {
        const local = validateSalesAiPromptForActivation(form.definition)
        if (!local.ok) {
          setValidationErrors(local.errors)
          return { status: 'validation', errors: local.errors }
        }
      }

      const description =
        form.description.trim() ||
        formatPromptDescriptionLabel({
          productSlug: form.productSlug,
          industrySlug: form.industrySlug,
          useCaseSlug: form.useCaseSlug,
        })

      try {
        const data = await salesEngineFetch<PromptResponse>('/api/sales/ai-prompts', {
          method: 'POST',
          body: JSON.stringify({
            productSlug: form.productSlug,
            industrySlug: form.industrySlug,
            useCaseSlug: form.useCaseSlug,
            description,
            definition: form.definition,
            activate,
            confirmReplace,
          }),
        })
        await refresh()
        return { status: 'ok', prompt: data.prompt }
      } catch (e) {
        const parsed = parseActivationError(e)
        if (parsed.status === 'validation') setValidationErrors(parsed.errors)
        if (parsed.status === 'error') setError(parsed.message)
        return parsed
      }
    },
    [refresh],
  )

  const updateDraft = useCallback(
    async (id: string, form: PromptLibraryFormState) => {
      const description =
        form.description.trim() ||
        formatPromptDescriptionLabel({
          productSlug: form.productSlug,
          industrySlug: form.industrySlug,
          useCaseSlug: form.useCaseSlug,
        })
      const data = await salesEngineFetch<PromptResponse>(`/api/sales/ai-prompts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description,
          definition: form.definition,
        }),
      })
      await refresh()
      return data.prompt
    },
    [refresh],
  )

  const activate = useCallback(
    async (id: string, confirmReplace = false): Promise<ActivationAttemptResult> => {
      setValidationErrors([])
      setError(null)
      const prompt = prompts.find((p) => p.id === id)
      if (prompt) {
        const local = validateSalesAiPromptForActivation(prompt.definition)
        if (!local.ok) {
          setValidationErrors(local.errors)
          return { status: 'validation', errors: local.errors }
        }
      }
      try {
        await salesEngineFetch(`/api/sales/ai-prompts/${id}/activate`, {
          method: 'POST',
          body: JSON.stringify({ confirmReplace }),
        })
        await refresh()
        return { status: 'ok' }
      } catch (e) {
        const parsed = parseActivationError(e)
        if (parsed.status === 'validation') setValidationErrors(parsed.errors)
        if (parsed.status === 'error') setError(parsed.message)
        return parsed
      }
    },
    [prompts, refresh],
  )

  const deactivate = useCallback(
    async (id: string) => {
      await salesEngineFetch(`/api/sales/ai-prompts/${id}/deactivate`, { method: 'POST' })
      await refresh()
    },
    [refresh],
  )

  const slots = useMemo(() => {
    const map = new Map<string, SalesAiPrompt[]>()
    for (const p of prompts) {
      const key = p.prompt_name
      const list = map.get(key) ?? []
      list.push(p)
      map.set(key, list)
    }
    return [...map.entries()].map(([promptName, versions]) => ({
      promptName,
      versions: versions.sort((a, b) => b.version - a.version),
      active: versions.find((v) => v.is_active) ?? null,
    }))
  }, [prompts])

  return {
    prompts,
    slots,
    loading,
    error,
    setError,
    validationErrors,
    setValidationErrors,
    productFilter,
    setProductFilter,
    industryFilter,
    setIndustryFilter,
    useCaseFilter,
    setUseCaseFilter,
    activeOnly,
    setActiveOnly,
    refresh,
    publishVersion,
    updateDraft,
    activate,
    deactivate,
  }
}
