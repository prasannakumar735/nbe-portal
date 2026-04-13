import { NextResponse } from 'next/server'
import { requireManagerOrAdmin } from '@/lib/users/staff'
import { updateClientUser } from '@/lib/clients/service'
import type { ClientUserStatus } from '@/lib/types/client-users.types'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: {
    name?: string
    companyName?: string
    email?: string
    clientId?: string
    status?: ClientUserStatus
  } = {}

  if (typeof body.name === 'string') patch.name = body.name
  if (typeof body.company_name === 'string') patch.companyName = body.company_name
  if (typeof body.email === 'string') patch.email = body.email
  if (typeof body.client_id === 'string') patch.clientId = body.client_id
  if (body.status === 'active' || body.status === 'disabled') {
    patch.status = body.status
  }

  const result = await updateClientUser(id, patch)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ client: result.client })
}
