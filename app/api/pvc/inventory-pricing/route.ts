import { NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'

export async function GET() {
  try {
    await requirePortalStaff()
    const admin = createServiceRoleClient()

    const [bulkRoll, headrail, rivetPlates] = await Promise.all([
      admin.from('pvc_bulk_roll_pricing').select('*').order('grade').order('strip_width').order('thickness'),
      admin.from('pvc_headrail_pricing').select('*').order('material').order('length'),
      admin.from('pvc_rivet_plate_pricing').select('*').order('material').order('size'),
    ])

    if (bulkRoll.error) throw bulkRoll.error
    if (headrail.error) throw headrail.error
    if (rivetPlates.error) throw rivetPlates.error

    return NextResponse.json({
      ok: true,
      bulk_roll: bulkRoll.data,
      headrail: headrail.data,
      rivet_plates: rivetPlates.data,
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: 'Failed to load inventory pricing.' }, { status: 500 })
  }
}
