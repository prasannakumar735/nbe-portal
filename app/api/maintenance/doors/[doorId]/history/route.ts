import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ doorId: string }> },
) {
  try {
    const { doorId } = await params
    if (!doorId) {
      return NextResponse.json({ history: [] })
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('door_inspections')
      .select('id, created_at, technician_notes, ai_summary, report:report_id (inspection_date)')
      .eq('door_id', doorId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      throw error
    }

    const history = (data ?? []).map(row => {
      const record = row as Record<string, unknown>
      const report = (record.report ?? {}) as Record<string, unknown>

      return {
        id: String(record.id ?? ''),
        inspection_date: String(report.inspection_date ?? '').trim() || null,
        created_at: String(record.created_at ?? ''),
        technician_notes: String(record.technician_notes ?? '').trim(),
        ai_summary: String(record.ai_summary ?? '').trim(),
      }
    })

    return NextResponse.json({ history })
  } catch {
    return NextResponse.json({ history: [] })
  }
}
