import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type DoorSummaryRequest = {
  door_number?: string
  technician_notes?: string
  previous_summary?: string
  attempt?: number
}

function buildPrompt(input: {
  doorNumber: string
  technicianNotes: string
  variationId: string
  previousSummary: string
  attempt: number
}): string {
  return [
    `Rewrite STRICTLY following the example style.`,
    `Do NOT use phrases like "needs to be".`,
    `This is attempt ${input.attempt}. Improve the previous rewrite while preserving ALL details from the original notes.`,
    `Do NOT add new facts. Do NOT omit any facts from the original.`,
    input.previousSummary.trim()
      ? `Your output MUST differ from the previous rewrite. Do NOT repeat any full sentence verbatim.`
      : `If there is no previous rewrite, produce the best first rewrite.`,
    `Variation: ${input.variationId} (do not include this line in output)`,
    '',
    `Door: ${input.doorNumber}`,
    '',
    `Original Technician Notes:`,
    input.technicianNotes,
    '',
    input.previousSummary.trim()
      ? `Previous Rewrite (improve this; keep meaning; remove repetition; keep one issue per sentence):\n${input.previousSummary}`
      : `Previous Rewrite: (none)`,
  ].join('\n')
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DoorSummaryRequest

    const doorNumber = String(body.door_number ?? '').trim() || 'Door'
    const technicianNotes = String(body.technician_notes ?? '').trim()
    const previousSummary = String(body.previous_summary ?? '').trim()
    const attemptRaw = Number(body.attempt ?? 1)
    const attempt = Number.isFinite(attemptRaw) && attemptRaw > 0 ? Math.trunc(attemptRaw) : 1

    if (!technicianNotes) {
      return NextResponse.json(
        { error: 'Technician notes are required.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured in .env.local' },
        { status: 500 }
      )
    }

    const groq = new Groq({ apiKey })

    const variationId = crypto.randomUUID()
    const textPrompt = buildPrompt({
      doorNumber,
      technicianNotes,
      variationId,
      previousSummary,
      attempt,
    })

    const runOnce = async (opts?: { temperature?: number; top_p?: number; extraUserHint?: string }) => {
      const userContent = opts?.extraUserHint
        ? `${textPrompt}\n\nExtra instruction: ${opts.extraUserHint}`
        : textPrompt
      const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: opts?.temperature ?? 0.3,
      top_p: opts?.top_p ?? 0.95,
      messages: [
        {
          role: 'system',
          content: [
            'You are an experienced industrial door technician writing professional maintenance report notes.',
            '',
            'Your writing must read like a real technician report, not AI-generated text.',
            '',
            'STRICT RULES (MANDATORY):',
            '',
            '- Each defect MUST be written as a separate sentence.',
            '- Do NOT combine multiple issues in one sentence.',
            '- Do NOT use phrases like "needs to be", "needs", or "should be".',
            '- Use direct action wording: "requires repair", "requires replacement", "requires rectification".',
            '- Preserve ALL details exactly as provided.',
            '- Do NOT add assumptions or extra information.',
            '- Do NOT include commentary such as "not applicable", "the correct statement is", or explanations about formatting.',
            '- Do NOT restate the input and then critique it. Only rewrite.',
            '- If the note says something was fixed (e.g. "has been rectified"), keep that meaning and do NOT convert it into "requires repair".',
            '- Do NOT infer or introduce operation modes (manual/auto) unless explicitly stated in the notes.',
            '',
            'SAFETY RULE (VERY IMPORTANT):',
            '',
            '- Only write a safety-risk sentence if the input explicitly states a safety risk (e.g. "posing a safety risk").',
            '- If included, it MUST be a separate sentence.',
            '- Do NOT add a safety-risk sentence just because a defect seems dangerous.',
            '',
            'STYLE RULES:',
            '',
            '- Use short, clear, professional sentences.',
            '- Avoid repetitive phrasing.',
            '- Use natural technician tone (not robotic).',
            '- Avoid rewriting into casual language.',
            '',
            'WRITING FORMAT:',
            '',
            '- Issue → Action',
            '- One issue per sentence',
            '',
            'EXAMPLE (FOLLOW THIS STYLE EXACTLY):',
            '',
            'Top cover is bent and requires repair or replacement.',
            'Safety edge is disconnected due to a cut curly cord and requires repair.',
            'Curtain fabric is worn and requires replacement.',
            'Curtain edges (top, mid, bottom) are detached from the safety edge and require repair.',
            'Control box wiring is loose with detached and exposed wires.',
            'This poses a safety risk and requires immediate repair.',
            'Electrical conduit is not properly fixed or secured and requires rectification.',
            '',
            'OUTPUT RULES:',
            '',
            '- Return only the rewritten notes.',
            '- No headings.',
            '- No bullet points.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    })
      return completion.choices?.[0]?.message?.content?.trim() || ''
    }

    const format = (text: string) =>
      text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/([.!?])\s+(?=[A-Z(])/g, '$1\n')

    let summary = await runOnce({
      temperature: attempt >= 2 ? 0.12 : 0.3,
      top_p: attempt >= 2 ? 0.9 : 0.95,
    })

    if (!summary) {
      return NextResponse.json(
        { error: 'No AI summary returned.' },
        { status: 400 }
      )
    }

    // Clean formatting AFTER validation
    let cleaned = format(summary)

    if (previousSummary && cleaned.trim() === previousSummary.trim()) {
      summary = await runOnce({
        temperature: attempt >= 2 ? 0.22 : 0.45,
        top_p: attempt >= 2 ? 0.92 : 0.98,
        extraUserHint:
          'Rewrite again with different wording. Do not repeat any sentence verbatim. Keep one issue per sentence.',
      })
      if (summary) cleaned = format(summary)
    }

    return NextResponse.json({ summary: cleaned })

  } catch (error) {
    console.error('AI Door Summary Error:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to generate door summary.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}