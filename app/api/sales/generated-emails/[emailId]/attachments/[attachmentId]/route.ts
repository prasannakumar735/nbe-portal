import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { deleteSalesBrochureObject } from '@/lib/sales/attachments/salesBrochureStorage'
import {
  deleteSalesGeneratedEmailAttachment,
  getSalesGeneratedEmailAttachmentById,
  updateSalesGeneratedEmailAttachmentEnabled,
} from '@/lib/sales/repositories/salesGeneratedEmailAttachmentRepository'
import { getSalesGeneratedEmailById } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'
import {
  patchGeneratedEmailAttachmentBodySchema,
  salesGeneratedEmailAttachmentIdParamSchema,
} from '@/lib/sales/validators/emailAttachment.validators'
import { ZodError } from 'zod'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ emailId: string; attachmentId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 4096)
    const params = salesGeneratedEmailAttachmentIdParamSchema.parse(await context.params)
    const email = await getSalesGeneratedEmailById(auth.supabase, params.emailId)
    if (!email) return fail('Generated email not found', 404)

    const row = await getSalesGeneratedEmailAttachmentById(auth.supabase, params.attachmentId)
    if (!row || row.generated_email_id !== params.emailId) {
      return fail('Attachment not found', 404)
    }

    const body = await request.json()
    const parsed = patchGeneratedEmailAttachmentBodySchema.parse(body)
    const updated = await updateSalesGeneratedEmailAttachmentEnabled(
      auth.supabase,
      params.attachmentId,
      parsed.enabled,
    )
    return ok({ attachment: updated })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update attachment', 500)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const params = salesGeneratedEmailAttachmentIdParamSchema.parse(await context.params)
    const email = await getSalesGeneratedEmailById(auth.supabase, params.emailId)
    if (!email) return fail('Generated email not found', 404)

    const row = await getSalesGeneratedEmailAttachmentById(auth.supabase, params.attachmentId)
    if (!row || row.generated_email_id !== params.emailId) {
      return fail('Attachment not found', 404)
    }

    const deleted = await deleteSalesGeneratedEmailAttachment(auth.supabase, params.attachmentId)
    if (deleted?.source === 'upload') {
      try {
        await deleteSalesBrochureObject(deleted.storage_path)
      } catch {
        // ignore storage cleanup failure
      }
    }

    return ok({ deleted: true })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete attachment', 500)
  }
}
