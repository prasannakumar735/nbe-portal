import { NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import React from 'react'
import BusinessCard from '@/components/business-card/BusinessCard'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { getContactDisplayName, getContactQrPayload } from '@/lib/contact-qr'
import { generateQRCode } from '@/lib/generateQRCode'
import type { Contact } from '@/lib/types/contact.types'

export const runtime = 'nodejs'

const BUSINESS_CARD_WIDTH = 1050
const BUSINESS_CARD_HEIGHT = 600
const BACKGROUND_IMAGE_URL = process.env.BUSINESS_CARD_TEMPLATE_URL

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const supabase = createServiceRoleClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('id, slug, first_name, last_name, company, title, phone, email, website, street, city, state, postcode, country, status, qr_type, created_at')
      .eq('slug', slug)
      .maybeSingle<Contact>()

    if (error || !contact || contact.status !== 'active') {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const qrDataUrl = await generateQRCode(getContactQrPayload(contact))
    const safeName = getContactDisplayName(contact).replace(/[^a-z0-9\-_. ]/gi, '').trim() || 'contact'

    const logoUrl = new URL('/nbe-logo.png', request.url).toString()

    const image = new ImageResponse(
      React.createElement(BusinessCard, {
        contact,
        qrDataUrl,
        backgroundImageUrl: BACKGROUND_IMAGE_URL,
        logoUrl,
      }),
      {
        width: BUSINESS_CARD_WIDTH,
        height: BUSINESS_CARD_HEIGHT,
      }
    )

    // Materialize the stream inside try/catch so renderer errors return JSON
    // instead of terminating the HTTP connection with an empty response.
    const pngBuffer = await image.arrayBuffer()

    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${safeName}-business-card.png"`,
        // Hook for future export pipeline (e.g. PDF assembly endpoint).
        'x-business-card-format': 'png',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate business card'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
