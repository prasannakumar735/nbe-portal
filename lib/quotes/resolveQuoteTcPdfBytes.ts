import type { SupabaseClient } from '@supabase/supabase-js'

export type QuoteTcType = 'INDUSTRIAL_RAPID_DOOR' | 'PVC_FLEX_SYSTEM'
export type QuoteTcEndUser = 'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER'

/**
 * Looks up an admin-uploaded T&C PDF override from Supabase storage for the given
 * quote's T&C type + end user (CUSTOMER/DISTRIBUTOR/TENDER). Both Rapid Door and
 * PVC Flex System T&C are keyed per end-user. Returns null if no override has been
 * uploaded for that quote_type/end_user_type combination — callers then fall back
 * to the bundled default PDFs (currently the same bundled Rapid Door files are
 * shared as the PVC Flex System default, until PVC-specific ones are uploaded).
 */
export async function resolveQuoteTcPdfBytes(
  supabase: SupabaseClient,
  tcType: QuoteTcType | undefined,
  endUser: QuoteTcEndUser | '' | undefined,
): Promise<Buffer | null> {
  const resolvedType = tcType ?? 'INDUSTRIAL_RAPID_DOOR'
  if (!endUser) return null

  try {
    const { data: tcRow } = await supabase
      .from('quote_tc_documents')
      .select('storage_path')
      .eq('quote_type', resolvedType)
      .eq('end_user_type', endUser)
      .maybeSingle()

    if (!tcRow?.storage_path) return null

    const { data: fileData } = await supabase.storage
      .from('quote-tc-documents')
      .download(tcRow.storage_path)

    if (!fileData) return null
    return Buffer.from(await fileData.arrayBuffer())
  } catch {
    return null
  }
}
