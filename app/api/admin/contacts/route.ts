import { NextResponse } from 'next/server'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { generateQRCode } from '@/lib/generateQRCode'
import { getContactQrPayload } from '@/lib/contact-qr'
import type { Contact, ContactQrType, ContactStatus } from '@/lib/types/contact.types'

export const runtime = 'nodejs'

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildDefaultSlug(firstName: string, lastName: string): string {
  return normalizeSlug(`${firstName}-${lastName}`) || `contact-${Date.now()}`
}

export async function GET() {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('contacts')
      .select('id, slug, first_name, last_name, company, title, phone, email, website, street, city, state, postcode, country, status, qr_type, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const contacts = (data ?? []) as Contact[]
    const withQr = await Promise.all(
      contacts.map(async (contact) => ({
        ...contact,
        qr_data_url: await generateQRCode(getContactQrPayload(contact)),
      }))
    )

    return NextResponse.json({ contacts: withQr })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch contacts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const payload = (await request.json()) as Partial<Contact>
    const firstName = String(payload.first_name ?? '').trim()
    const lastName = String(payload.last_name ?? '').trim()
    const slug = normalizeSlug(String(payload.slug ?? '')) || buildDefaultSlug(firstName, lastName)

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First name and last name are required.' }, { status: 400 })
    }

    const status: ContactStatus = payload.status === 'inactive' ? 'inactive' : 'active'
    const qrType: ContactQrType = payload.qr_type === 'vcard' ? 'vcard' : 'dynamic'

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        slug,
        first_name: firstName,
        last_name: lastName,
        company: payload.company ?? null,
        title: payload.title ?? null,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        website: payload.website ?? null,
        street: payload.street ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        postcode: payload.postcode ?? null,
        country: payload.country ?? null,
        status,
        qr_type: qrType,
      })
      .select('id, slug, first_name, last_name, company, title, phone, email, website, street, city, state, postcode, country, status, qr_type, created_at')
      .single<Contact>()

    if (error) {
      const statusCode = error.code === '23505' ? 409 : 500
      return NextResponse.json({ error: error.message }, { status: statusCode })
    }

    return NextResponse.json({ contact: data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create contact'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
