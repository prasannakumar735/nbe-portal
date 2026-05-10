import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const siteSlug = request.nextUrl.searchParams.get('site')?.trim().toLowerCase() ?? ''
  if (!siteSlug) {
    return new NextResponse('site query parameter is required', { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role === 'client') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data: site } = await supabase
    .from('office_clock_sites')
    .select('slug')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (!site) {
    return new NextResponse('Unknown site', { status: 404 })
  }

  try {
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`.replace(/\/+$/, '')
    const target = `${baseUrl}/office/clock?site=${encodeURIComponent(siteSlug)}`
    const pngBuffer = await QRCode.toBuffer(target, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
    })
    return new NextResponse(pngBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[GET /api/office-clock/qr]', e)
    return new NextResponse('Failed to generate QR', { status: 500 })
  }
}
