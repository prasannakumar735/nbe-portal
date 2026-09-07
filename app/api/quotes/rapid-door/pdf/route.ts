import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { generateRapidDoorQuotePdf, type RapidDoorQuotePdfInput, type DoorLineItem } from '@/lib/pdf/generateRapidDoorQuotePdf'

const DOOR_IMAGE_CONFIG: Record<string, string> = {
  PE01:  'PE125',
  SP01:  'SP150',
  FR01:  'FR150',
  CAD01: 'CAD200',
  CL01:  'CL125',
  ES01:  'ES125',
}

function resolveDoorImagePath(
  doorType: string,
  colourCode: string | null | undefined,
  imageStyle: string,
): string | null {
  if (!doorType || !colourCode) return null
  const prefix = DOOR_IMAGE_CONFIG[doorType]
  if (!prefix) return null
  const folder = imageStyle === 'withText' ? 'withText' : 'withOutText'
  return path.join(process.cwd(), 'public', 'images', folder, doorType, `${prefix}_${colourCode}.png`)
}

export async function POST(request: NextRequest) {
  try {
    await requirePortalStaff()

    const body = await request.json() as RapidDoorQuotePdfInput & {
      doors?: (DoorLineItem & { colourCode?: string | null })[]
      colourCode?: string
      imageStyle?: string
    }

    const imageStyle = body.imageStyle ?? 'withOutText'

    // Resolve door image paths for every door in the array
    if (body.doors?.length) {
      body.doors = body.doors.map(d => ({
        ...d,
        doorImagePath: resolveDoorImagePath(d.doorType, d.colourCode, imageStyle),
      }))
    } else if (body.doorType && body.colourCode) {
      body.doorImagePath = resolveDoorImagePath(body.doorType, body.colourCode, imageStyle)
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
