'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import {
  EMPTY_EMAIL_TEMPLATE_PROMPT_CONFIG,
  type SalesEmailTemplatePromptConfig,
} from '@/lib/sales/types/emailTemplatePromptConfig'
import {
  formFieldsToPromptConfig,
  promptConfigToFormFields,
  type EmailTemplatePromptFormFields,
} from '@/lib/sales/emailTemplateFormUtils'
import type { SalesCampaignTypeRecord } from '@/lib/sales/types/campaignLookup.types'
import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'
import { salesEmailTemplatePromptConfigSchema } from '@/lib/sales/validators/emailTemplatePromptConfig.validators'

export type EmailTemplateFormValues = {
  campaignTypeId: string
  templateName: string
  prompt: EmailTemplatePromptFormFields
  isActive: boolean
}

type ListResponse = { templates: SalesEmailTemplate[] }
type TemplateResponse = { template: SalesEmailTemplate }
type CampaignTypesResponse = { types: SalesCampaignTypeRecord[] }

const emptyPromptFields = (): EmailTemplatePromptFormFields =>
  promptConfigToFormFields(EMPTY_EMAIL_TEMPLATE_PROMPT_CONFIG)

const emptyForm = (): EmailTemplateFormValues => ({
  campaignTypeId: '',
  templateName: '',
  prompt: emptyPromptFields(),
  isActive: true,
})

export function templateToFormValues(t: SalesEmailTemplate): EmailTemplateFormValues {
  return {
    campaignTypeId: t.campaign_type_id,
    templateName: t.template_name,
    prompt: promptConfigToFormFields(t.prompt_config),
    isActive: t.is_active,
  }
}

function validateForm(values: EmailTemplateFormValues): string | null {
  if (!values.campaignTypeId) return 'Campaign type is required.'
  if (!values.templateName.trim()) return 'Template name is required.'
  const promptConfig = formFieldsToPromptConfig(values.prompt)
  const parsed = salesEmailTemplatePromptConfigSchema.safeParse(promptConfig)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid prompt configuration.'
  }
  return null
}

function toApiPromptConfig(values: EmailTemplateFormValues): SalesEmailTemplatePromptConfig {
  return formFieldsToPromptConfig(values.prompt)
}

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<SalesEmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [campaignTypeFilter, setCampaignTypeFilter] = useState<string>('')

  const [campaignTypes, setCampaignTypes] = useState<SalesCampaignTypeRecord[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)

  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setCatalogLoading(true)
      try {
        const data = await salesEngineFetch<CampaignTypesResponse>(
          '/api/sales/campaign-types?activeOnly=false',
        )
        if (!cancelled) setCampaignTypes(data.types)
      } catch {
        if (!cancelled) setCampaignTypes([])
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const fetchTemplates = useCallback(async (cancelled: () => boolean) => {
    setLoading(true)
    setError(null)
    try {
      const params = campaignTypeFilter
        ? `?campaignTypeId=${encodeURIComponent(campaignTypeFilter)}`
        : ''
      const data = await salesEngineFetch<ListResponse>(`/api/sales/email-templates${params}`)
      if (!cancelled()) setTemplates(data.templates)
    } catch (e) {
      if (!cancelled()) {
        setError(e instanceof Error ? e.message : 'Failed to load templates')
      }
    } finally {
      if (!cancelled()) setLoading(false)
    }
  }, [campaignTypeFilter])

  useEffect(() => {
    let cancelled = false
    void fetchTemplates(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [fetchTemplates])

  const createTemplate = useCallback(async (values: EmailTemplateFormValues) => {
    const validationError = validateForm(values)
    if (validationError) throw new Error(validationError)

    setSaving(true)
    try {
      const data = await salesEngineFetch<TemplateResponse>('/api/sales/email-templates', {
        method: 'POST',
        body: JSON.stringify({
          campaignTypeId: values.campaignTypeId,
          templateName: values.templateName.trim(),
          promptConfig: toApiPromptConfig(values),
          isActive: values.isActive,
        }),
      })
      setTemplates((prev) => [data.template, ...prev])
      toast.success('Template created')
      return data.template
    } finally {
      setSaving(false)
    }
  }, [])

  const updateTemplate = useCallback(async (id: string, values: EmailTemplateFormValues) => {
    const validationError = validateForm(values)
    if (validationError) throw new Error(validationError)

    setSaving(true)
    try {
      const data = await salesEngineFetch<TemplateResponse>(`/api/sales/email-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          campaignTypeId: values.campaignTypeId,
          templateName: values.templateName.trim(),
          promptConfig: toApiPromptConfig(values),
          isActive: values.isActive,
        }),
      })
      setTemplates((prev) => prev.map((t) => (t.id === id ? data.template : t)))
      toast.success(`Template updated (v${data.template.version})`)
      return data.template
    } finally {
      setSaving(false)
    }
  }, [])

  const setTemplateActive = useCallback(async (id: string, isActive: boolean) => {
    setTogglingId(id)
    try {
      const data = await salesEngineFetch<TemplateResponse>(
        `/api/sales/email-templates/${id}/activate`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive }),
        },
      )
      setTemplates((prev) => prev.map((t) => (t.id === id ? data.template : t)))
      toast.success(isActive ? 'Template enabled' : 'Template disabled')
    } finally {
      setTogglingId(null)
    }
  }, [])

  return {
    templates,
    loading,
    error,
    campaignTypes,
    catalogLoading,
    campaignTypeFilter,
    setCampaignTypeFilter,
    saving,
    togglingId,
    createTemplate,
    updateTemplate,
    setTemplateActive,
    reload: fetchTemplates,
    emptyForm,
  }
}
