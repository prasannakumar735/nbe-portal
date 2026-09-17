import { NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function GET() {
  try {
    await requirePortalStaff()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceRoleClient()
  const { data, error } = await sb
    .from('quote_field_tooltips')
    .select('field_key, tooltip_text')

  if (error) return NextResponse.json({}, { status: 500 })

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.field_key] = row.tooltip_text
  return NextResponse.json(map)
}
