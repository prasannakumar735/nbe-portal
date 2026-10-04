import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  buildSalesBrochureStoragePath,
  uploadSalesBrochureBytes,
} from '@/lib/sales/attachments/salesBrochureStorage'
import {
  createSalesGeneratedEmailAttachment,
  listSalesGeneratedEmailAttachments,
} from '@/lib/sales/repositories/salesGeneratedEmailAttachmentRepository'
import { getSalesGeneratedEmailById } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { generatedEmailReviewIdParamSchema } from '@/lib/sales/validators'
import {
  assertAttachmentCountAndTotalSize,
  validateSalesAttachmentFileMeta,
} from '@/lib/sales/validators/emailAttachment.validators'
import {
  SALES_EMAIL_ATTACHMENTS_MIGRATION_HINT,
  isMissingRelationError,
} from '@/lib/sales/supabase/postgrestErrorUtils'

function mapAttachmentsListError(error: unknown) {
  if (error instanceof ZodError) {
    return fail('Validation failed', 422, error.issues)
  }
  if (isMissingRelationError(error)) {
    return fail(`Email attachments are not available. ${SALES_EMAIL_ATTACHMENTS_MIGRATION_HINT}`, 503)
  }
  return fail(error instanceof Error ? error.message : 'Failed to list attachments', 500)
}



type RouteContext = { params: Promise<{ emailId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { emailId } = generatedEmailReviewIdParamSchema.parse({
      emailId: (await context.params).emailId,
    })
    const email = await getSalesGeneratedEmailById(auth.supabase, emailId)
    if (!email) return fail('Generated email not found', 404)

    const attachments = await listSalesGeneratedEmailAttachments(auth.supabase, emailId)
    return ok({ attachments })
  } catch (error) {
    return mapAttachmentsListError(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { emailId } = generatedEmailReviewIdParamSchema.parse({
      emailId: (await context.params).emailId,
    })
    const email = await getSalesGeneratedEmailById(auth.supabase, emailId)
    if (!email) return fail('Generated email not found', 404)

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return fail('file is required', 400)
    }

    const byteSize = file.size
    const contentType = file.type || 'application/octet-stream'
    const fileName = file.name || 'attachment'
    validateSalesAttachmentFileMeta({ fileName, contentType, byteSize })

    const existing = await listSalesGeneratedEmailAttachments(auth.supabase, emailId)
    assertAttachmentCountAndTotalSize(existing, byteSize)

    const buf = Buffer.from(await file.arrayBuffer())
    const storagePath = buildSalesBrochureStoragePath(`email/${emailId}`, fileName)
    await uploadSalesBrochureBytes({ path: storagePath, bytes: buf, contentType })

    const attachment = await createSalesGeneratedEmailAttachment(auth.supabase, {
      generated_email_id: emailId,
      storage_path: storagePath,
      file_name: fileName,
      content_type: contentType,
      byte_size: byteSize,
      source: 'upload',
      enabled: true,
      sort_order: existing.length,
    })

    return ok({ attachment })
  } catch (error) {
    if (isMissingRelationError(error)) {
      return fail(`Email attachments are not available. ${SALES_EMAIL_ATTACHMENTS_MIGRATION_HINT}`, 503)
    }
    return fail(error instanceof Error ? error.message : 'Failed to upload attachment', 400)
  }
}
