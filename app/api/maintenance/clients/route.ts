import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

function mapClientRow(row: Record<string, unknown>) {
  const name = String(row.client_name ?? row.name ?? row.company_name ?? '').trim()
  return {
    id: String(row.id ?? ''),
    name: name || 'Unknown Client',
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
