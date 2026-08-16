import { z } from 'zod'
import { SALES_EMAIL_MESSAGE_DIRECTIONS, SALES_EMAIL_MESSAGE_IMPORT_SOURCES } from '@/lib/sales/constants/emailMessageDirections'
import { SALES_EMAIL_THREAD_STATUSES } from '@/lib/sales/constants/emailThreadStatuses'
import {
  SALES_MANAGER_NOTIFICATION_PRIORITIES,
  SALES_MANAGER_NOTIFICATION_TYPES,
} from '@/lib/sales/constants/managerNotifications'
import { SALES_REPLY_ANALYSIS_CATEGORIES, SALES_REPLY_ANALYSIS_STATUSES } from '@/lib/sales/constants/replyAnalysis'
import { SALES_REPLY_DRAFT_STATUSES } from '@/lib/sales/constants/replyDraftStatuses'

export const salesEmailThreadStatusSchema = z.enum(SALES_EMAIL_THREAD_STATUSES)
export const salesEmailMessageDirectionSchema = z.enum(SALES_EMAIL_MESSAGE_DIRECTIONS)
export const salesEmailMessageImportSourceSchema = z.enum(SALES_EMAIL_MESSAGE_IMPORT_SOURCES)
export const salesReplyAnalysisStatusSchema = z.enum(SALES_REPLY_ANALYSIS_STATUSES)
export const salesReplyAnalysisCategorySchema = z.enum(SALES_REPLY_ANALYSIS_CATEGORIES)
export const salesReplyDraftStatusSchema = z.enum(SALES_REPLY_DRAFT_STATUSES)
export const salesManagerNotificationTypeSchema = z.enum(SALES_MANAGER_NOTIFICATION_TYPES)
export const salesManagerNotificationPrioritySchema = z.enum(SALES_MANAGER_NOTIFICATION_PRIORITIES)

const confidence = z.number().min(0).max(1).optional().nullable()

export const salesEmailThreadListQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  status: salesEmailThreadStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const salesEmailThreadIdParamSchema = z.object({
  threadId: z.string().uuid(),
})

export const createSalesEmailThreadBodySchema = z.object({
  campaignId: z.string().uuid(),
  contactId: z.string().uuid(),
  businessId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  graphConversationId: z.string().trim().max(500).optional().nullable(),
  graphThreadId: z.string().trim().max(500).optional().nullable(),
  status: salesEmailThreadStatusSchema.optional(),
})

export const patchSalesEmailThreadBodySchema = z.object({
  status: salesEmailThreadStatusSchema.optional(),
  businessId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  graphConversationId: z.string().trim().max(500).optional().nullable(),
  graphThreadId: z.string().trim().max(500).optional().nullable(),
})

export const createSalesEmailMessageBodySchema = z.object({
  threadId: z.string().uuid(),
  direction: salesEmailMessageDirectionSchema,
  generatedEmailId: z.string().uuid().optional().nullable(),
  deliveryLogId: z.string().uuid().optional().nullable(),
  graphMessageId: z.string().trim().max(500).optional().nullable(),
  internetMessageId: z.string().trim().max(500).optional().nullable(),
  conversationId: z.string().trim().max(500).optional().nullable(),
  inReplyTo: z.string().trim().max(500).optional().nullable(),
  sender: z.string().trim().max(320).optional().nullable(),
  recipients: z.array(z.union([z.string().email(), z.string().min(3)])).max(50).optional(),
  subject: z.string().max(1000).default(''),
  bodyHtml: z.string().max(500_000).optional().nullable(),
  bodyText: z.string().max(500_000).optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
  importSource: salesEmailMessageImportSourceSchema.optional(),
})

export const insertSalesReplyAnalysisBodySchema = z.object({
  messageId: z.string().uuid(),
  analysisVersion: z.number().int().min(1),
  modelName: z.string().max(120).optional().nullable(),
  promptVersion: z.number().int().min(1).optional().nullable(),
  summary: z.string().max(20_000).optional().nullable(),
  sentiment: z.string().max(120).optional().nullable(),
  buyingIntent: z.string().max(500).optional().nullable(),
  categories: z.array(salesReplyAnalysisCategorySchema).max(20).optional(),
  urgency: z.string().max(120).optional().nullable(),
  suggestedNextAction: z.string().max(2000).optional().nullable(),
  confidence: confidence,
  analysisStatus: salesReplyAnalysisStatusSchema.optional(),
})

export const createSalesReplyDraftBodySchema = z.object({
  threadId: z.string().uuid(),
  inReplyToMessageId: z.string().uuid().optional().nullable(),
  subject: z.string().trim().min(1).max(1000),
  body: z.string().min(1).max(100_000),
  promptLibraryId: z.string().uuid().optional().nullable(),
  promptName: z.string().max(200).optional().nullable(),
  promptVersion: z.number().int().min(1).optional().nullable(),
})

export const patchSalesReplyDraftBodySchema = z.object({
  subject: z.string().trim().min(1).max(1000).optional(),
  body: z.string().min(1).max(100_000).optional(),
  status: salesReplyDraftStatusSchema.optional(),
})

export const salesReplyDraftIdParamSchema = z.object({
  draftId: z.string().uuid(),
})

export const createSalesManagerNotificationBodySchema = z.object({
  notificationType: salesManagerNotificationTypeSchema,
  priority: salesManagerNotificationPrioritySchema,
  threadId: z.string().uuid().optional().nullable(),
  messageId: z.string().uuid().optional().nullable(),
})

export const salesManagerNotificationListQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export const markSalesManagerNotificationsReadBodySchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1).max(100),
})

export const analyzeReplyThreadBodySchema = z.object({
  messageId: z.string().uuid().optional(),
  provider: z.string().trim().max(40).optional().nullable(),
})
