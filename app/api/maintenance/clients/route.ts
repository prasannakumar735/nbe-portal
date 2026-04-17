import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { clientNameFromDbRow } from '@/lib/supabase/clientsDb'

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
