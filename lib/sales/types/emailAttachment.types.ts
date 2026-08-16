export type SalesOfferAttachment = {
  id: string
  offer_type_id: string
  storage_path: string
  file_name: string
  content_type: string
  byte_size: number
  sort_order: number
  created_by: string | null
  created_at: string
}

export type SalesGeneratedEmailAttachmentSource = 'offer' | 'upload'

export type SalesGeneratedEmailAttachment = {
  id: string
  generated_email_id: string
  storage_path: string
  file_name: string
  content_type: string
  byte_size: number
  source: SalesGeneratedEmailAttachmentSource
  offer_attachment_id: string | null
  enabled: boolean
  sort_order: number
  created_at: string
}

export type SalesOfferAttachmentInsert = {
  offer_type_id: string
  storage_path: string
  file_name: string
  content_type: string
  byte_size: number
  sort_order?: number
  created_by?: string | null
}

export type SalesGeneratedEmailAttachmentInsert = {
  generated_email_id: string
  storage_path: string
  file_name: string
  content_type: string
  byte_size: number
  source: SalesGeneratedEmailAttachmentSource
  offer_attachment_id?: string | null
  enabled?: boolean
  sort_order?: number
}
