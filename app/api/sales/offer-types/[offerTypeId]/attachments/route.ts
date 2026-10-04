import { NextRequest, NextResponse } from 'next/server'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  buildSalesBrochureStoragePath,
  uploadSalesBrochureBytes,
} from '@/lib/sales/attachments/salesBrochureStorage'
import {
  createSalesOfferAttachment,
  listSalesOfferAttachmentsByOfferTypeId,
} from '@/lib/sales/repositories/salesOfferAttachmentRepository'
import { getSalesOfferTypeById } from '@/lib/sales/repositories/salesOfferTypeRepository'
import {
  assertAttachmentCountAndTotalSize,
  salesOfferTypeIdParamSchema,
  validateSalesAttachmentFileMeta,
} from '@/lib/sales/validators/emailAttachment.validators'



type RouteContext = { params: Promise<{ offerTypeId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { offerTypeId } = salesOfferTypeIdParamSchema.parse({
      offerTypeId: (await context.params).offerTypeId,
    })
    const offer = await getSalesOfferTypeById(auth.supabase, offerTypeId)
    if (!offer) return fail('Offer type not found', 404)

    const attachments = await listSalesOfferAttachmentsByOfferTypeId(auth.supabase, offerTypeId)
    return ok({ attachments })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to list attachments', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { offerTypeId } = salesOfferTypeIdParamSchema.parse({
      offerTypeId: (await context.params).offerTypeId,
    })
    const offer = await getSalesOfferTypeById(auth.supabase, offerTypeId)
    if (!offer) return fail('Offer type not found', 404)

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return fail('file is required', 400)
    }

    const byteSize = file.size
    const contentType = file.type || 'application/octet-stream'
    const fileName = file.name || 'attachment'
    validateSalesAttachmentFileMeta({ fileName, contentType, byteSize })

    const existing = await listSalesOfferAttachmentsByOfferTypeId(auth.supabase, offerTypeId)
    assertAttachmentCountAndTotalSize(existing, byteSize)

    const buf = Buffer.from(await file.arrayBuffer())
    const storagePath = buildSalesBrochureStoragePath(`offer/${offerTypeId}`, fileName)
    await uploadSalesBrochureBytes({ path: storagePath, bytes: buf, contentType })

    const attachment = await createSalesOfferAttachment(auth.supabase, {
      offer_type_id: offerTypeId,
      storage_path: storagePath,
      file_name: fileName,
      content_type: contentType,
      byte_size: byteSize,
      sort_order: existing.length,
      created_by: auth.userId,
    })

    return ok({ attachment })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to upload attachment', 400)
  }
}
