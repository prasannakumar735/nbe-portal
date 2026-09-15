import { NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export type DoorOption = {
  code:        string
  label:       string
  description: string
  hexColour:   string | null
  sortOrder:   number
}

export type DoorOptionsMap = Record<string, DoorOption[]>

export async function GET() {
  try {
    await requirePortalStaff()

    const sb = createServiceRoleClient()
    const { data, error } = await sb
      .from('rapid_door_option_map')
      .select('category, code, label, description, hex_colour, sort_order')
      .eq('is_active', true)
      .order('category')
      .order('sort_order')

    if (error) throw error

    const grouped: DoorOptionsMap = {}
    for (const row of data ?? []) {
      if (!grouped[row.category]) grouped[row.category] = []
      grouped[row.category].push({
        code:        row.code,
        label:       row.label,
        description: row.description,
        hexColour:   row.hex_colour,
        sortOrder:   row.sort_order,
      })
    }

    return NextResponse.json(grouped)
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to load options.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
