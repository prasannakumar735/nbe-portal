import { NextResponse } from 'next/server'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import type { ContactQrType, ContactStatus } from '@/lib/types/contact.types'

export const runtime = 'nodejs'

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { id } = await params
    const payload = (await request.json()) as Record<string, string | null | undefined>
    const updates: Record<string, string | null> = {}

    if (typeof payload.slug === 'string') updates.slug = normalizeSlug(payload.slug)
    if (typeof payload.first_name === 'string') updates.first_name = payload.first_name.trim()
    if (typeof payload.last_name === 'string') updates.last_name = payload.last_name.trim()
    if (payload.company !== undefined) updates.company = payload.company?.trim() || null
    if (payload.title !== undefined) updates.title = payload.title?.trim() || null
    if (payload.phone !== undefined) updates.phone = payload.phone?.trim() || null
    if (payload.email !== undefined) updates.email = payload.email?.trim() || null
    if (payload.website !== undefined) updates.website = payload.website?.trim() || null
    if (payload.street !== undefined) updates.street = payload.street?.trim() || null
    if (payload.city !== undefined) updates.city = payload.city?.trim() || null
    if (payload.state !== undefined) updates.state = payload.state?.trim() || null
    if (payload.postcode !== undefined) updates.postcode = payload.postcode?.trim() || null
    if (payload.country !== undefined) updates.country = payload.country?.trim() || null
    if (payload.status !== undefined) {
      const status: ContactStatus = payload.status === 'inactive' ? 'inactive' : 'active'
      updates.status = status
    }
    if (payload.qr_type !== undefined) {
      const qrType: ContactQrType = payload.qr_type === 'vcard' ? 'vcard' : 'dynamic'
      updates.qr_type = qrType
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select('id, slug, first_name, last_name, company, title, phone, email, website, street, city, state, postcode, country, status, qr_type, created_at')
      .single()

    if (error) {
      const statusCode = error.code === '23505' ? 409 : 500
      return NextResponse.json({ error: error.message }, { status: statusCode })
    }

    return NextResponse.json({ contact: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update contact'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
