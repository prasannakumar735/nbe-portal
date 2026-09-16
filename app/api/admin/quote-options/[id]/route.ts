import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePortalStaff()
    const { id } = await params
    const body = await request.json() as {
      code?: string; label?: string; description?: string
      hex_colour?: string | null; sort_order?: number; is_active?: boolean
    }

    const sb = createServiceRoleClient()
    const update: Record<string, unknown> = {}
    if (body.code        !== undefined) update.code        = body.code.trim()
    if (body.label       !== undefined) update.label       = body.label.trim()
    if (body.description !== undefined) update.description = body.description.trim()
    if (body.hex_colour  !== undefined) update.hex_colour  = body.hex_colour
    if (body.sort_order  !== undefined) update.sort_order  = body.sort_order
    if (body.is_active   !== undefined) update.is_active   = body.is_active

    const { data, error } = await sb
      .from('rapid_door_option_map')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePortalStaff()
    const { id } = await params

    const sb = createServiceRoleClient()
    const { error } = await sb
      .from('rapid_door_option_map')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
