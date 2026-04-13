import { NextResponse } from 'next/server'
import { requireManagerOrAdmin } from '@/lib/users/staff'
import { listClientUsers } from '@/lib/clients/service'

export const runtime = 'nodejs'

export async function GET() {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 })
  }

  const { clients, error } = await listClientUsers()
  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ clients })
}
