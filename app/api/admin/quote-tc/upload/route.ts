import { NextRequest } from 'next/server'
import { requireManagerOrAdminApi, ok, fail } from '@/app/api/admin/_utils'

const ALLOWED_QUOTE_TYPES = [
  'INDUSTRIAL_RAPID_DOOR',
  'PVC_FLEX_SYSTEM',
  'MAINTENANCE_SERVICE_REPAIR',
  'PARTS',
  'GENERAL',
]

const ALLOWED_END_USER_TYPES = ['CUSTOMER', 'DISTRIBUTOR', 'TENDER', 'ALL']

export async function POST(request: NextRequest) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const formData = await request.formData()
  const file         = formData.get('file')         as File | null
  const quoteType    = formData.get('quoteType')    as string | null
  const endUserType  = formData.get('endUserType')  as string | null

  if (!file || !quoteType || !endUserType)
    return fail('file, quoteType, and endUserType are required')
  if (!ALLOWED_QUOTE_TYPES.includes(quoteType))
    return fail('Invalid quoteType')
  if (!ALLOWED_END_USER_TYPES.includes(endUserType))
    return fail('Invalid endUserType')
  if (file.type !== 'application/pdf')
    return fail('Only PDF files are accepted')
  if (file.size > 20 * 1024 * 1024)
    return fail('File must be under 20 MB')

  const { supabase, userId } = auth
  const storagePath = `${quoteType}/${endUserType}.pdf`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('quote-tc-documents')
    .upload(storagePath, arrayBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) return fail(`Storage upload failed: ${uploadError.message}`, 500)

  const { error: dbError } = await supabase
    .from('quote_tc_documents')
    .upsert(
      {
        quote_type:    quoteType,
        end_user_type: endUserType,
        storage_path:  storagePath,
        file_name:     file.name,
        uploaded_by:   userId,
      },
      { onConflict: 'quote_type,end_user_type' },
    )

  if (dbError) return fail(`Database update failed: ${dbError.message}`, 500)

  return ok({ storagePath, fileName: file.name })
}
