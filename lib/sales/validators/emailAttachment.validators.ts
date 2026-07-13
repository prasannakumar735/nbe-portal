import { z } from 'zod'
import {
  SALES_EMAIL_ATTACHMENT_MAX_BYTES_PER_FILE,
  SALES_EMAIL_ATTACHMENT_MAX_COUNT,
  SALES_EMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
  isAllowedSalesEmailAttachmentMimeType,
} from '@/lib/sales/constants/salesEmailAttachmentLimits'

export const salesOfferTypeIdParamSchema = z.object({
  offerTypeId: z.string().uuid(),
})

export const salesOfferAttachmentIdParamSchema = z.object({
  offerTypeId: z.string().uuid(),
  attachmentId: z.string().uuid(),
})

export const salesGeneratedEmailAttachmentIdParamSchema = z.object({
  emailId: z.string().uuid(),
  attachmentId: z.string().uuid(),
})

export const patchGeneratedEmailAttachmentBodySchema = z.object({
  enabled: z.boolean(),
})

export type AttachmentFileMeta = {
  fileName: string
  contentType: string
  byteSize: number
}

export function validateSalesAttachmentFileMeta(meta: AttachmentFileMeta): void {
  if (!meta.fileName.trim()) {
    throw new Error('File name is required.')
  }
  if (meta.byteSize <= 0) {
    throw new Error('File is empty.')
  }
  if (meta.byteSize > SALES_EMAIL_ATTACHMENT_MAX_BYTES_PER_FILE) {
    throw new Error(`Each file must be at most ${SALES_EMAIL_ATTACHMENT_MAX_BYTES_PER_FILE / (1024 * 1024)} MB.`)
  }
  if (!isAllowedSalesEmailAttachmentMimeType(meta.contentType)) {
    throw new Error('File type must be PDF, PNG, JPEG, or WebP.')
  }
}

export function assertAttachmentCountAndTotalSize(
  existing: { byte_size: number }[],
  incomingByteSize: number,
): void {
  if (existing.length >= SALES_EMAIL_ATTACHMENT_MAX_COUNT) {
    throw new Error(`At most ${SALES_EMAIL_ATTACHMENT_MAX_COUNT} attachments allowed.`)
  }
  const total = existing.reduce((sum, row) => sum + row.byte_size, 0) + incomingByteSize
  if (total > SALES_EMAIL_ATTACHMENT_MAX_TOTAL_BYTES) {
    throw new Error(`Total attachment size must be at most ${SALES_EMAIL_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MB.`)
  }
}
