import { NextResponse } from 'next/server'
import { generateVCard } from '@/lib/generateVCard'
import { parsePublicContactSlug } from '@/lib/security/publicContactSlug'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { getContactDisplayName } from '@/lib/contact-qr'
import type { Contact } from '@/lib/types/contact.types'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: raw } = await params
    const slug = parsePublicContactSlug(raw)
    if (!slug) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    /** Public catalog read: service role because `contacts` is not exposed to `anon`; slug is validated above (not identity). */
    const supabase = createServiceRoleClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('id, slug, first_name, last_name, company, title, phone, email, website, street, city, state, postcode, country, status, qr_type, created_at')
      .eq('slug', slug)
      .maybeSingle<Contact>()

    if (error || !contact || contact.status !== 'active') {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const vcard = generateVCard(contact)
    const safeName = getContactDisplayName(contact).replace(/[^a-z0-9\-_. ]/gi, '').trim() || 'contact'

    return new NextResponse(vcard, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.vcf"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate vCard'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
