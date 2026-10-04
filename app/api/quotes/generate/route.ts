import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateProposalPdf } from '@/lib/pdf/generateProposalPdf'
import { uploadPdfToOneDrive } from '@/lib/onedrive/uploadPdf'
import { sendQuoteEmail } from '@/lib/email/sendQuoteEmail'
import { pvcQuoteFinalizeRowFromPdf } from '@/lib/pvc/pvcQuotesDb'
import type { ProposalDoor, QuoteData, QuoteGenerateRequest, QuoteGenerateResponse } from '@/lib/types/quote.types'



const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function hasGraphCredentials(): boolean {
  return Boolean(
    process.env.MS_GRAPH_ACCESS_TOKEN ||
    (process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET),
  )
}

function hasGraphMailCredentials(): boolean {
  return hasGraphCredentials() && Boolean(process.env.MS_GRAPH_MAIL_USER_ID || process.env.MS_ONEDRIVE_USER_ID)
}

function hasSupabaseWriteCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function createSupabaseWriteClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for quote generation writes.')
}

function validateQuoteData(quoteData: QuoteData): void {
  const { input, calculated } = quoteData

  const requiredNumbers: Array<[string, number]> = [
    ['width_mm', input.width_mm],
    ['height_mm', input.height_mm],
    ['strip_width_mm', input.strip_width_mm],
    ['thickness_mm', input.thickness_mm],
    ['overlap_mm', input.overlap_mm],
    ['strip_count', calculated.strip_count],
    ['strip_length_mm', calculated.strip_length_mm],
    ['strip_meters', calculated.strip_meters],
    ['pvc_strip_cost', calculated.pvc_strip_cost],
    ['headrail_cost', calculated.headrail_cost],
    ['bracket_cost', calculated.bracket_cost],
    ['fittings_cost', calculated.fittings_cost],
    ['packaging_cost', calculated.packaging_cost],
    ['labour_cost', calculated.labour_cost],
    ['subtotal', calculated.subtotal],
    ['markup_percent', calculated.markup_percent],
    ['final_quote_price', calculated.final_quote_price],
  ]

  for (const [key, value] of requiredNumbers) {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid quote payload: ${key} must be a finite number.`)
    }
  }

  const requiredText = [
    ['strip_type', input.strip_type],
    ['headrail_type', input.headrail_type],
    ['install_type', input.install_type],
  ] as const

  for (const [key, value] of requiredText) {
    if (!value || !value.trim()) {
      throw new Error(`Invalid quote payload: ${key} is required.`)
    }
  }

  if (quoteData.doors) {
    if (!Array.isArray(quoteData.doors) || quoteData.doors.length === 0) {
      throw new Error('Invalid quote payload: doors must be a non-empty array when provided.')
    }

    quoteData.doors.forEach((door: ProposalDoor, index) => {
      const numbers: Array<[string, number]> = [
        ['width_mm', door.width_mm],
        ['height_mm', door.height_mm],
        ['overlap_mm', door.overlap_mm],
        ['strip_width_mm', door.strip_width_mm],
        ['thickness_mm', door.thickness_mm],
        ['number_of_strips', door.number_of_strips],
        ['final_door_price', door.final_door_price],
      ]

      if (door.quantity !== undefined) {
        const q = door.quantity
        if (!Number.isFinite(q) || q < 1 || q > 99 || Math.trunc(q) !== q) {
          throw new Error(`Invalid quote payload: doors[${index}].quantity must be an integer from 1 to 99.`)
        }
      }

      numbers.forEach(([key, value]) => {
        if (!Number.isFinite(value)) {
          throw new Error(`Invalid quote payload: doors[${index}].${key} must be a finite number.`)
        }
      })
    })
  }
}

async function insertQuoteRecord(
  supabase: SupabaseClient,
  quoteData: QuoteData,
): Promise<string | null> {
  const requestedShape = {
    width_mm: quoteData.input.width_mm,
    height_mm: quoteData.input.height_mm,
    strip_type: quoteData.input.strip_type,
    strip_width_mm: quoteData.input.strip_width_mm,
    strip_count: quoteData.calculated.strip_count,
    total_price: quoteData.calculated.final_quote_price,
    created_at: new Date().toISOString(),
  }

  const requestedInsert = await supabase
    .from('pvc_quotes')
    .insert(requestedShape)
    .select('id')
    .single()

  if (!requestedInsert.error && requestedInsert.data?.id) {
    return String(requestedInsert.data.id)
  }

  const fallbackShape = {
    opening_width_mm: quoteData.input.width_mm,
    opening_height_mm: quoteData.input.height_mm,
    strip_type: quoteData.input.strip_type,
    strip_width_mm: quoteData.input.strip_width_mm,
    thickness_mm: quoteData.input.thickness_mm,
    overlap_percent: quoteData.input.overlap_mm,
    headrail_type: quoteData.input.headrail_type,
    installation_type: quoteData.input.install_type,
    subtotal: quoteData.calculated.subtotal,
    total_price: quoteData.calculated.final_quote_price,
    created_at: new Date().toISOString(),
  }

  const fallbackInsert = await supabase
    .from('pvc_quotes')
    .insert(fallbackShape)
    .select('id')
    .single()

  if (fallbackInsert.error) {
    throw fallbackInsert.error
  }

  return fallbackInsert.data?.id ? String(fallbackInsert.data.id) : null
}

async function finalizeDraftQuoteRecord(
  supabase: SupabaseClient,
  draftId: string,
  quoteData: QuoteData,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('pvc_quotes')
    .update(
      pvcQuoteFinalizeRowFromPdf({
        calculated: quoteData.calculated,
        customerDetails: quoteData.customerDetails,
      }),
    )
    .eq('id', draftId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.id ? String(data.id) : draftId
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuoteGenerateRequest
    const quoteData = body.quoteData
    const draftIdRaw = typeof body.draftId === 'string' ? body.draftId.trim() : ''
    const draftId = UUID_RE.test(draftIdRaw) ? draftIdRaw : null

    if (!quoteData) {
      throw new Error('Missing quoteData in request body.')
    }

    validateQuoteData(quoteData)

    const now = Date.now()
    const fileName = `PVC_Quote_${now}.pdf`
    const date = new Date(now)
    const uploadPath = `NBE Quotes/${date.getFullYear()}/${date.toLocaleString('en-AU', { month: 'long' })}/${fileName}`

    const pdfBytes = await generateProposalPdf(quoteData)
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64')

    let oneDriveWebUrl: string | null = null
    let oneDriveDownloadUrl: string | null = null
    let oneDriveStatus: 'uploaded' | 'skipped' | 'failed' = 'skipped'
    let oneDriveReason: string | undefined

    if (hasGraphCredentials()) {
      try {
        const oneDriveUpload = await uploadPdfToOneDrive(pdfBytes, fileName)
        oneDriveWebUrl = oneDriveUpload.webUrl
        oneDriveDownloadUrl = oneDriveUpload.downloadUrl
        oneDriveStatus = 'uploaded'
      } catch (oneDriveError) {
        oneDriveStatus = 'failed'
        oneDriveReason = oneDriveError instanceof Error ? oneDriveError.message : 'OneDrive upload failed.'
      }
    } else {
      oneDriveReason = 'Microsoft Graph credentials not configured.'
    }

    let quoteId: string | null = null
    let databaseStatus: 'inserted' | 'skipped' | 'failed' = 'skipped'
    let databaseReason: string | undefined

    if (hasSupabaseWriteCredentials()) {
      try {
        const supabase = createSupabaseWriteClient()
        if (draftId) {
          quoteId = await finalizeDraftQuoteRecord(supabase, draftId, quoteData)
        } else {
          quoteId = await insertQuoteRecord(supabase, quoteData)
        }
        databaseStatus = 'inserted'
      } catch (dbError) {
        databaseStatus = 'failed'
        databaseReason = dbError instanceof Error ? dbError.message : 'Database insert failed.'
      }
    } else {
      databaseReason = 'Supabase service role credentials not configured.'
    }

    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped'
    let emailReason: string | undefined

    if (hasGraphMailCredentials()) {
      try {
        await sendQuoteEmail(quoteData, pdfBytes, fileName)
        emailStatus = 'sent'
      } catch (mailError) {
        emailStatus = 'failed'
        emailReason = mailError instanceof Error ? mailError.message : 'Email delivery failed.'
      }
    } else {
      emailReason = 'Microsoft Graph mail credentials not configured.'
    }

    const response: QuoteGenerateResponse = {
      pdfUrl: oneDriveDownloadUrl,
      pdfBase64: oneDriveDownloadUrl ? undefined : pdfBase64,
      fileName,
      quoteId,
      audit: {
        oneDrive: {
          status: oneDriveStatus,
          uploadPath,
          webUrl: oneDriveWebUrl,
          reason: oneDriveReason,
        },
        email: {
          status: emailStatus,
          to: 'accountsreceivable@nbeaustralia.com.au',
          reason: emailReason,
        },
        database: {
          status: databaseStatus,
          quoteId,
          reason: databaseReason,
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate quote PDF.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
