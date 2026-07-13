import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { deleteSalesBrochureObject } from '@/lib/sales/attachments/salesBrochureStorage'
import {
  deleteSalesOfferAttachment,
  getSalesOfferAttachmentById,
} from '@/lib/sales/repositories/salesOfferAttachmentRepository'
import { getSalesOfferTypeById } from '@/lib/sales/repositories/salesOfferTypeRepository'
import { salesOfferAttachmentIdParamSchema } from '@/lib/sales/validators/emailAttachment.validators'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ offerTypeId: string; attachmentId: string }> }

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const params = salesOfferAttachmentIdParamSchema.parse(await context.params)
    const offer = await getSalesOfferTypeById(auth.supabase, params.offerTypeId)
    if (!offer) return fail('Offer type not found', 404)

    const row = await getSalesOfferAttachmentById(auth.supabase, params.attachmentId)
    if (!row || row.offer_type_id !== params.offerTypeId) {
      return fail('Attachment not found', 404)
    }

    const deleted = await deleteSalesOfferAttachment(auth.supabase, params.attachmentId)
    if (deleted) {
      try {
        await deleteSalesBrochureObject(deleted.storage_path)
      } catch {
        // DB row removed; orphan object is acceptable vs blocking delete.
      }
    }

    return ok({ deleted: true })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete attachment', 500)
  }
}
