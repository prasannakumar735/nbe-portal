export const SALES_EMAIL_ATTACHMENT_MAX_COUNT = 5
export const SALES_EMAIL_ATTACHMENT_MAX_BYTES_PER_FILE = 5 * 1024 * 1024
export const SALES_EMAIL_ATTACHMENT_MAX_TOTAL_BYTES = 10 * 1024 * 1024

export const SALES_EMAIL_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export type SalesEmailAttachmentMimeType = (typeof SALES_EMAIL_ATTACHMENT_ALLOWED_MIME_TYPES)[number]

export function isAllowedSalesEmailAttachmentMimeType(
  contentType: string,
): contentType is SalesEmailAttachmentMimeType {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return (SALES_EMAIL_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(normalized)
}

export function isImageSalesEmailAttachmentMimeType(contentType: string): boolean {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return normalized.startsWith('image/')
}
