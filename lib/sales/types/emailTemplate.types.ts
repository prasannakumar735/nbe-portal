import type { SalesEmailTemplatePromptConfig } from '@/lib/sales/types/emailTemplatePromptConfig'

export type SalesEmailTemplate = {
  id: string
  campaign_type_id: string
  campaign_type_name?: string
  template_name: string
  prompt_config: SalesEmailTemplatePromptConfig
  version: number
  is_active: boolean
  created_at: string
}

export type SalesEmailTemplateInsert = {
  campaign_type_id: string
  template_name: string
  prompt_config: SalesEmailTemplatePromptConfig
  version?: number
  is_active?: boolean
}

export type SalesEmailTemplateUpdate = {
  campaign_type_id?: string
  template_name?: string
  prompt_config?: SalesEmailTemplatePromptConfig
  version?: number
  is_active?: boolean
}
