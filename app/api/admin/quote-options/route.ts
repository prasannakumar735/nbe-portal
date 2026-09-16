import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function GET(request: NextRequest) {
  try {
    await requirePortalStaff()
    const category = request.nextUrl.searchParams.get('category')

    const sb = createServiceRoleClient()
    let query = sb
      .from('rapid_door_option_map')
      .select('id, category, code, label, description, hex_colour, sort_order, is_active')
      .order('category')
      .order('sort_order')

    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()
    const body = await request.json() as {
      category: string; code: string; label: string
      description?: string; hex_colour?: string | null; sort_order?: number
    }

    if (!body.category || !body.code || !body.label) {
      return NextResponse.json({ ok: false, error: 'category, code and label are required' }, { status: 400 })
    }

    const sb = createServiceRoleClient()
    const { data, error } = await sb
      .from('rapid_door_option_map')
      .insert({
        category:    body.category,
        code:        body.code.trim(),
        label:       body.label.trim(),
        description: (body.description ?? '').trim(),
        hex_colour:  body.hex_colour ?? null,
        sort_order:  body.sort_order ?? 0,
        is_active:   true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: `Code "${body.code}" already exists in this category` }, { status: 409 })
      }
      throw error
    }
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
