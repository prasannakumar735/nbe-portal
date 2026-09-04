import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { generateRapidDoorQuotePdf, type RapidDoorQuotePdfInput, type DoorLineItem } from '@/lib/pdf/generateRapidDoorQuotePdf'

const DOOR_IMAGE_CONFIG: Record<string, { prefix: string; ext: string }> = {
  PE01:  { prefix: 'PE125',  ext: 'webp' },
  SP01:  { prefix: 'SP150',  ext: 'webp' },
  FR01:  { prefix: 'FR150',  ext: 'webp' },
  CAD01: { prefix: 'CAD200', ext: 'webp' },
  CL01:  { prefix: 'CL125',  ext: 'png'  },
  ES01:  { prefix: 'ES125',  ext: 'webp' },
}

function resolveDoorImagePath(doorType: string, colourCode: string | null | undefined): string | null {
  if (!doorType || !colourCode) return null
  const cfg = DOOR_IMAGE_CONFIG[doorType]
  if (!cfg) return null
  return path.join(process.cwd(), 'public', 'images', 'quotes', doorType, `${cfg.prefix}_${colourCode}.${cfg.ext}`)
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()

    const body = await request.json() as RapidDoorQuotePdfInput & {
      doors?: (DoorLineItem & { colourCode?: string | null })[]
      colourCode?: string
    }

    // Resolve door image paths for every door in the array
    if (body.doors?.length) {
      body.doors = body.doors.map(d => ({
        ...d,
        doorImagePath: resolveDoorImagePath(d.doorType, d.colourCode),
      }))
    } else if (body.doorType && body.colourCode) {
      // Legacy single-door path
      body.doorImagePath = resolveDoorImagePath(body.doorType, body.colourCode)
    }

    const pdfBytes = await generateRapidDoorQuotePdf(body)
    const filename = `${body.quoteNumber}_CUSTOMER_(SUMMARY).pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to generate PDF.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
