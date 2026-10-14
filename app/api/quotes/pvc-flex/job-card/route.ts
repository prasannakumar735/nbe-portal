import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { localDateKeyYmd } from '@/lib/quotes/quoteNumberPolicy'
import { nextQuoteNumberFromDb } from '@/lib/quotes/nextQuoteNumberFromDb'
import { calcPvcNewQuote, autoRaisedHeadrailSize } from '@/lib/pvc/pvcNewQuoteCalculator'
import type { PvcNewQuoteSpec } from '@/lib/pvc/pvcNewQuoteCalculator'
import { generatePvcFlexJobCardPdf } from '@/lib/pdf/generatePvcFlexJobCardPdf'
import type { PvcFlexJobCardDoor, PvcFlexJobCardInput } from '@/lib/pdf/generatePvcFlexJobCardPdf'

export const runtime = 'nodejs'

type PvcFlexDoorItem = {
  id: string
  openingW: string | number
  openingH: string | number
  stripWidth: number
  thickness: number
  grade: string
  profile: string
  hanger: string
  supplyType: string
  mountingType: string
  sliding?: string
  raisedHeadrail?: boolean | string
  qty: number
}

export async function POST(req: NextRequest) {
  try {
    await requirePortalStaff()

    const body = await req.json().catch(() => ({})) as {
      quoteId?:     string
      quoteNumber?: string
      assignedToId?: string
      poReference?:  string
      jobName?:      string
      requiredBy?:   string
    }

    const { quoteId, quoteNumber, assignedToId, poReference, jobName, requiredBy } = body

    if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })
    if (!assignedToId) return NextResponse.json({ error: 'assignedToId required' }, { status: 400 })

    const supabase = createServiceRoleClient()

    // Load the quote
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_name, site_address, form_snapshot')
      .eq('id', quoteId)
      .maybeSingle()

    if (qErr || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Load assignee name
    const { data: assigneeProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', assignedToId)
      .maybeSingle()

    const assignedToName = String((assigneeProfile as { full_name?: string } | null)?.full_name ?? '').trim() || 'Unknown'

    // Generate job card number (queries quotes table for existing JCPF numbers today)
    const dateKey = localDateKeyYmd(new Date())
    const jobCardNumber = await nextQuoteNumberFromDb(supabase, 'JCPF', dateKey)
    // Add dashes for readability on the PDF: JCPF-261014-001
    const jcDisplay = jobCardNumber.replace(/^(JCPF)(\d{6})(\d{3})$/, '$1-$2-$3')

    // Extract doors from form_snapshot
    const snap = (quote as { form_snapshot?: Record<string, unknown> }).form_snapshot ?? {}
    const savedDoors: PvcFlexDoorItem[] = (snap.savedPvcDoors as PvcFlexDoorItem[] | undefined) ?? []

    const doors: PvcFlexJobCardDoor[] = savedDoors
      .filter(d => d.openingW && d.openingH)
      .map((d, i) => {
        const openingW = parseFloat(String(d.openingW)) || 0
        const openingH = parseFloat(String(d.openingH)) || 0

        const raisedHREnabled = d.raisedHeadrail === true || d.raisedHeadrail === 'M' || d.raisedHeadrail === 'L'
        const raisedHR = raisedHREnabled ? autoRaisedHeadrailSize(openingW) : 'NA' as const

        const spec: PvcNewQuoteSpec = {
          openingW,
          openingH,
          stripWidth:    d.stripWidth,
          thickness:     d.thickness,
          grade:         d.grade as PvcNewQuoteSpec['grade'],
          profile:       d.profile as PvcNewQuoteSpec['profile'],
          hanger:        d.hanger as PvcNewQuoteSpec['hanger'],
          supplyType:    d.supplyType as PvcNewQuoteSpec['supplyType'],
          mountingType:  d.mountingType as PvcNewQuoteSpec['mountingType'],
          sliding:       (d.sliding ?? 'NA') as PvcNewQuoteSpec['sliding'],
          raisedHeadrail: raisedHR,
        }
        const calc = calcPvcNewQuote(spec)

        return {
          doorLabel:    `Door ${i + 1}`,
          openingW,
          openingH,
          stripWidth:   d.stripWidth,
          thickness:    d.thickness,
          grade:        d.grade,
          profile:      d.profile,
          hanger:       d.hanger,
          supplyType:   d.supplyType,
          numStrips:    calc.numStrips,
          cutLengthMm:  calc.cutLengthMm,
          coverageM:    calc.coverageM,
          sliding:      d.sliding,
          raisedHeadrail: raisedHR !== 'NA' ? raisedHR : undefined,
          qty:          d.qty ?? 1,
        }
      })

    if (doors.length === 0) {
      return NextResponse.json({ error: 'No doors found in this quote.' }, { status: 400 })
    }

    const now = new Date()
    const createdDate = now.toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Australia/Melbourne',
    })

    let requiredByDisplay = requiredBy ?? ''
    if (requiredBy) {
      try {
        requiredByDisplay = new Date(requiredBy).toLocaleDateString('en-AU', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      } catch { /* leave as-is */ }
    }

    const customerName    = String((quote as { customer_name?: string }).customer_name ?? '').trim() || '—'
    const customerAddress = String((quote as { site_address?: string }).site_address ?? '').trim() || '—'
    const displayQuoteNumber = quoteNumber ?? String((quote as { quote_number?: string }).quote_number ?? '')

    // Derive scope of work from snapshot: if installation cost > 0 → Supply & Install, else Supply Only
    const installationVal = parseFloat(String(snap.pvcInstallation ?? '')) || 0
    const scopeOfWork = installationVal > 0 ? 'Supply & Install' : 'Supply Only'

    const input: PvcFlexJobCardInput = {
      jobCardNumber:   jcDisplay,
      quoteNumber:     displayQuoteNumber,
      assignedToName,
      poReference:     poReference || undefined,
      jobName:         jobName || undefined,
      requiredBy:      requiredByDisplay || undefined,
      createdDate,
      customerName,
      customerAddress,
      scopeOfWork,
      doors,
    }

    const pdfBytes = await generatePvcFlexJobCardPdf(input)

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${jcDisplay}.pdf"`,
        'x-job-card-number':   jcDisplay,
      },
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to generate job card.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
