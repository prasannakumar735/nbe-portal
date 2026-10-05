import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { generatePvcFlexQuotePdf, type PvcFlexQuotePdfInput } from '@/lib/pdf/generatePvcFlexQuotePdf'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

async function resolveTcPdfBytes(endUser: string | '' | undefined): Promise<Buffer | null> {
  if (!endUser) return null
  try {
    const sb = createServiceRoleClient()
    const { data: rows } = await sb
      .from('quote_tc_documents')
      .select('storage_path, end_user_type')
      .eq('quote_type', 'PVC_FLEX_SYSTEM')

    if (!rows?.length) return null

    // Case-insensitive match against the free-text label, then fall back to any row labelled ALL
    const normalised = endUser.toLowerCase()
    const match =
      rows.find(r => r.end_user_type.toLowerCase() === normalised) ??
      rows.find(r => r.end_user_type.toLowerCase() === 'all')

    if (!match?.storage_path) return null

    const { data: fileData } = await sb.storage
      .from('quote-tc-documents')
      .download(match.storage_path)

    return fileData ? Buffer.from(await fileData.arrayBuffer()) : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()

    const body = await request.json() as PvcFlexQuotePdfInput & { tcPdfBytes?: Buffer }

    body.tcPdfBytes = await resolveTcPdfBytes(body.endUser) ?? undefined

    const pdfBytes = await generatePvcFlexQuotePdf(body)

    const safeName = (body.customerName || 'CUSTOMER')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50)
    const filename = `${body.quoteNumber}_${safeName}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to generate PDF.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
