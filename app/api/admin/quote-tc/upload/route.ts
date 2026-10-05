import { NextRequest } from 'next/server'
import { requireManagerOrAdminApi, ok, fail } from '@/app/api/admin/_utils'

const ALLOWED_QUOTE_TYPES = [
  'INDUSTRIAL_RAPID_DOOR',
  'PVC_FLEX_SYSTEM',
  'MAINTENANCE_SERVICE_REPAIR',
  'PARTS',
  'GENERAL',
]

export async function POST(request: NextRequest) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const formData    = await request.formData()
  const file        = formData.get('file')        as File | null
  const quoteType   = formData.get('quoteType')   as string | null
  const endUserType = (formData.get('endUserType') as string | null)?.trim()

  if (!file || !quoteType || !endUserType)
    return fail('file, quoteType, and endUserType are required')
  if (!ALLOWED_QUOTE_TYPES.includes(quoteType))
    return fail('Invalid quoteType')
  if (endUserType.length > 80)
    return fail('Label must be 80 characters or fewer')
  if (file.type !== 'application/pdf')
    return fail('Only PDF files are accepted')
  if (file.size > 20 * 1024 * 1024)
    return fail('File must be under 20 MB')

  const { supabase, userId } = auth
  // Slugify the label for the storage path so arbitrary text is safe as a filename
  const slug = endUserType.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const storagePath = `${quoteType}/${slug}.pdf`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('quote-tc-documents')
    .upload(storagePath, arrayBuffer, { contentType: 'application/pdf', upsert: true })

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

export async function DELETE(request: NextRequest) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const { quoteType, endUserType } = await request.json() as { quoteType: string; endUserType: string }

  if (!quoteType || !endUserType)
    return fail('quoteType and endUserType are required')
  if (!ALLOWED_QUOTE_TYPES.includes(quoteType))
    return fail('Invalid quoteType')

  const { supabase } = auth

  const { data: row } = await supabase
    .from('quote_tc_documents')
    .select('storage_path')
    .eq('quote_type', quoteType)
    .eq('end_user_type', endUserType)
    .maybeSingle()

  if (row?.storage_path) {
    await supabase.storage.from('quote-tc-documents').remove([row.storage_path])
  }

  const { error } = await supabase
    .from('quote_tc_documents')
    .delete()
    .eq('quote_type', quoteType)
    .eq('end_user_type', endUserType)

  if (error) return fail(error.message, 500)

  return ok({ deleted: true })
}
