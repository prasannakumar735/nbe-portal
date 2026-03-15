import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type DoorSummaryRequest = {
  door_number?: string
  technician_notes?: string
}

function buildPrompt(input: {
  doorNumber: string
  technicianNotes: string
}): string {
  return [
    `Door Number: ${input.doorNumber}`,
    '',
    'Technician Notes:',
    input.technicianNotes,
  ].join('\n')
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DoorSummaryRequest

    const doorNumber = String(body.door_number ?? '').trim() || 'Door'
    const technicianNotes = String(body.technician_notes ?? '').trim()

    if (!technicianNotes) {
      return NextResponse.json({ error: 'Technician notes are required.' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured in .env.local' },
        { status: 500 },
      )
    }

    const groq = new Groq({ apiKey })

    const textPrompt = buildPrompt({
      doorNumber,
      technicianNotes,
    })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'You are a technical writing assistant for industrial door maintenance reports.',
            '',
            'Your task is to rewrite technician notes into a concise and professional summary.',
            '',
            'Rules:',
            '',
            '* Only use the information provided in the technician notes.',
            '* Do NOT invent new faults or issues.',
            '* Do NOT interpret checklist results.',
            '* Do NOT add recommendations unless they are mentioned in the notes.',
            '* Keep the summary concise (3–5 lines maximum).',
            '* Write in clear professional maintenance language.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: textPrompt,
        },
      ],
    })

    const summary = completion.choices?.[0]?.message?.content?.trim() || ''

    if (!summary) {
      return NextResponse.json({ error: 'No AI summary returned.' }, { status: 400 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('AI Door Summary Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate door summary.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
