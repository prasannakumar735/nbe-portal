import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type SummaryRequest = {
  notes?: string
  report_id?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SummaryRequest
    const notes = body.notes?.trim() || ''
    const reportId = body.report_id?.trim() || null

    if (!notes) {
      return NextResponse.json({ error: 'Technician notes are required.' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured.' }, { status: 500 })
    }

    const groq = new Groq({ apiKey })

    const prompt = [
      'Rephrase the following industrial door maintenance technician notes into a single, professional structured maintenance summary.',
      'Use only the information provided in the notes. Do not add issues or recommendations that are not mentioned.',
      '',
      'Use this structure:',
      'Maintenance Summary',
      '',
      'Issues Identified',
      '* list of issues from the notes',
      '',
      'Safety Risks',
      '* hazards or risks mentioned',
      '',
      'Recommended Actions',
      '* maintenance or repair steps from the notes',
      '',
      'Priority',
      'Low / Medium / High (based on notes)',
      '',
      'Technician notes (compiled):',
      notes,
    ].join('\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are an industrial maintenance assistant. Rephrase technician notes into a clear, professional summary without adding new content.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = completion.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({ error: 'No AI summary returned.' }, { status: 400 })
    }

    if (reportId) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && serviceKey) {
        const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
        const { error } = await supabase
          .from('maintenance_reports')
          .update({ ai_summary: content })
          .eq('id', reportId)
        if (error) {
          console.error('[AI Maintenance Summary] Failed to save ai_summary:', error)
        }
      }
    }

    return NextResponse.json({ summary: content })
  } catch (error: unknown) {
    console.error('AI Summary Error:', error)

    const message = error instanceof Error ? error.message : 'AI summary failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
