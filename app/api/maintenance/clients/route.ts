import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { clientNameFromDbRow } from '@/lib/supabase/clientsDb'
import { requireMaintenanceStaffApi } from '@/lib/maintenance/requireMaintenanceStaffApi'
import { createClientSchema } from '@/lib/validation/admin-clients'

function mapClientRow(row: Record<string, unknown>) {
  const name = clientNameFromDbRow(row as { name?: string | null; client_name?: string | null; company_name?: string | null })
  return {
    id: String(row.id ?? ''),
    name,
  }
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      throw error
    }

    const clients = (data ?? [])
      .map(row => mapClientRow(row as Record<string, unknown>))
      .filter(item => item.id)
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ clients })
  } catch {
    return NextResponse.json({ clients: [] })
  }
}

export async function POST(request: Request) {
  const auth = await requireMaintenanceStaffApi()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = createClientSchema.parse(body)
    const trimmed = parsed.client_name.trim()

    const { data: duplicate } = await auth.supabase
      .from('clients')
      .select('id')
      .eq('name', trimmed)
      .maybeSingle()

    if (duplicate?.id) {
      return NextResponse.json({ error: 'A client with this name already exists.' }, { status: 409 })
    }

    const { data, error } = await auth.supabase
      .from('clients')
      .insert({ name: trimmed })
      .select('id, name, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const client = mapClientRow(data as Record<string, unknown>)
    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 422 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create client' },
      { status: 500 },
    )
  }
}
