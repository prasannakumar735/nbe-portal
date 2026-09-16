import { NextRequest, NextResponse } from 'next/server'
import { requireManagerOrAdminApi, fail } from '@/app/api/admin/_utils'

export async function GET(request: NextRequest) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const storagePath = request.nextUrl.searchParams.get('path')
  if (!storagePath) return fail('Missing path', 400)

  const { data, error } = await auth.supabase.storage
    .from('quote-tc-documents')
    .download(storagePath)

  if (error || !data) return fail(error?.message ?? 'File not found', 404)

  const fileName = storagePath.split('/').pop() ?? 'document.pdf'
  const buf = Buffer.from(await data.arrayBuffer())

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
