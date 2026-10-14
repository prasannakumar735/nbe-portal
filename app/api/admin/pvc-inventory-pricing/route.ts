import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
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
    return NextResponse.json({ error: 'Failed to load pricing.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { supabase, user } = await requirePortalStaff()
    const isManager = await isManagerOrAdmin(supabase, user.id)
    if (!isManager) {
      return NextResponse.json({ error: 'Manager role required.' }, { status: 403 })
    }

    const body = await req.json() as {
      table: 'bulk_roll' | 'headrail' | 'rivet_plates'
      id: string
      updates: Record<string, unknown>
    }

    const tableMap = {
      bulk_roll: 'pvc_bulk_roll_pricing',
      headrail: 'pvc_headrail_pricing',
      rivet_plates: 'pvc_rivet_plate_pricing',
    } as const

    const tableName = tableMap[body.table]
    if (!tableName) return NextResponse.json({ error: 'Invalid table.' }, { status: 400 })

    // Only allow updating numeric price fields
    const allowedFields = ['actual_cost', 'sales_fee', 'company_fee', 'shipping_fee', 'total_cost_default']
    const safeUpdates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body.updates) safeUpdates[field] = body.updates[field]
    }
    safeUpdates.updated_at = new Date().toISOString()

    const admin = createServiceRoleClient()
    const { error } = await admin.from(tableName).update(safeUpdates).eq('id', body.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: 'Failed to update pricing.' }, { status: 500 })
  }
}
