import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { generateRapidDoorQuotePdf, type RapidDoorQuotePdfInput, type DoorLineItem } from '@/lib/pdf/generateRapidDoorQuotePdf'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

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
    console.log('[rapid-door/pdf] customDoorImageBase64 present:', !!body.customDoorImageBase64, body.customDoorImageBase64?.slice(0, 40))

    // Resolve door image paths for every door in the array
    if (body.doors?.length) {
      body.doors = body.doors.map(d => ({
        ...d,
        doorImagePath: resolveDoorImagePath(d.doorType, d.colourCode, imageStyle),
      }))
    } else if (body.doorType && body.colourCode) {
      body.doorImagePath = resolveDoorImagePath(body.doorType, body.colourCode, imageStyle)
    }

    // Fetch option descriptions from DB (code→description per category)
    try {
      const sbOpts = createServiceRoleClient()
      const { data: optRows } = await sbOpts
        .from('rapid_door_option_map')
        .select('category, code, description')
        .eq('is_active', true)
      if (optRows?.length) {
        const descMap: Record<string, Record<string, string>> = {}
        for (const row of optRows) {
          if (!descMap[row.category]) descMap[row.category] = {}
          descMap[row.category][row.code] = row.description
        }
        body.optionDescriptions = descMap
      }
    } catch { /* fall back to code values if DB unavailable */ }

    // Resolve T&C bytes from Supabase storage (uploaded via admin), falling back to bundled local file
    if (body.endUser) {
      try {
        const sb = createServiceRoleClient()
        const { data: tcRow } = await sb
          .from('quote_tc_documents')
          .select('storage_path')
          .eq('quote_type', 'INDUSTRIAL_RAPID_DOOR')
          .eq('end_user_type', body.endUser)
          .maybeSingle()

        if (tcRow?.storage_path) {
          const { data: fileData } = await sb.storage
            .from('quote-tc-documents')
            .download(tcRow.storage_path)
          if (fileData) {
            body.tcPdfBytes = Buffer.from(await fileData.arrayBuffer())
          }
        }
      } catch { /* fall back to bundled local T&C */ }
    }

    const pdfBytes = await generateRapidDoorQuotePdf(body)
    const safeName = (body.customerName || 'CUSTOMER')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50)
    const endUserPart = body.endUser ? `_${body.endUser}` : ''
    const filename = `${body.quoteNumber}_${safeName}${endUserPart}.pdf`

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
