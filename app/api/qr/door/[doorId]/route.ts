import QRCode from 'qrcode'
import { createServerClient } from '@/lib/supabase/server'



export async function GET(
  request: Request,
  context: { params: Promise<{ doorId: string }> },
) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { doorId } = await context.params

  if (!doorId) {
    return new Response('doorId is required', { status: 400 })
  }

  try {
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`.replace(/\/+$/, '')
    const doorUrl = `${baseUrl}/door/${encodeURIComponent(doorId)}`

    const pngBuffer = await QRCode.toBuffer(doorUrl, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
    })

    return new Response(pngBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('[QR Door API] Failed to generate QR code:', error)
    return new Response('Failed to generate QR code', { status: 500 })
  }
}
