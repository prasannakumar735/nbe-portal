import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { generateQuote } from '../../../../lib/services/pvcCalculator.service'
import type {
  PVCCalculatorInput,
  PVCHangerWidth,
  PVCHeadrailType,
  PVCInstallationType,
  PVCOverlapMm,
  PVCStripType,
  PVCStripWidth,
} from '@/lib/types/pvc.types'

const STRIP_TYPES: PVCStripType[] = ['standard', 'ribbed', 'colour', 'polar', 'ribbed_polar']
const STRIP_WIDTHS: PVCStripWidth[] = [100, 150, 200, 300]
const HANGER_WIDTHS: PVCHangerWidth[] = [100, 150, 200, 300, 400, 1200, 1370]
const OVERLAP_VALUES: number[] = [0, 10, 15, 20, 25, 33, 50, 66, 100]
const HEADRAILS: PVCHeadrailType[] = ['stainless', 'galvanized', 'aluminium', 'plastic']
const INSTALL_TYPES: PVCInstallationType[] = ['supply_only', 'supply_install']

function createPricingClient() {
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

  return null
}

function asNumber(value: unknown): number {
  return Number(value)
}

function validateRequestBody(body: Record<string, unknown>): PVCCalculatorInput {
  const width = asNumber(body.width)
  const height = asNumber(body.height)
  const stripType = body.stripType as PVCStripType
  const stripWidth = asNumber(body.stripWidth) as PVCStripWidth
  const hangerWidth = asNumber(body.hangerWidth ?? body.hangerWidthMm ?? body.stripWidth) as PVCHangerWidth
  const stripsPerHangerRaw = asNumber(body.stripsPerHanger)
  const thickness = asNumber(body.thickness ?? body.stripThicknessMm)
  const overlap = asNumber(body.overlapMm ?? body.overlap) as PVCOverlapMm
  const headrailType = body.headrailType as PVCHeadrailType
  const installType = body.installType as PVCInstallationType

  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('Width must be a positive number.')
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error('Height must be a positive number.')
  }
  if (!STRIP_TYPES.includes(stripType)) {
    throw new Error('Invalid stripType.')
  }
  if (!STRIP_WIDTHS.includes(stripWidth)) {
    throw new Error('Invalid stripWidth.')
  }
  if (!HANGER_WIDTHS.includes(hangerWidth)) {
    throw new Error('Invalid hangerWidth.')
  }
  const stripsPerHanger = Number.isFinite(stripsPerHangerRaw) && [1, 2].includes(stripsPerHangerRaw)
    ? (stripsPerHangerRaw as 1 | 2)
    : (stripWidth === 100 && hangerWidth === 150 ? 2 : 1)
  if (stripWidth === 100 && ![1, 2].includes(stripsPerHanger)) {
    throw new Error('stripsPerHanger must be 1 or 2.')
  }
  if (!Number.isFinite(thickness) || thickness <= 0) {
    throw new Error('Thickness must be a positive number.')
  }
  if (!Number.isFinite(overlap) || !OVERLAP_VALUES.includes(overlap)) {
    throw new Error('Overlap must be one of the allowed legacy values in mm.')
  }
  if (overlap >= stripWidth && overlap !== 0) {
    throw new Error('Overlap must be less than stripWidth to keep effective coverage positive.')
  }
  if (!HEADRAILS.includes(headrailType)) {
    throw new Error('Invalid headrailType.')
  }
  if (!INSTALL_TYPES.includes(installType)) {
    throw new Error('Invalid installType.')
  }

  return {
    openingWidthMm: width,
    openingHeightMm: height,
    stripType,
    stripWidth,
    hangerWidthMm: hangerWidth,
    stripsPerHanger: stripWidth === 100 ? stripsPerHanger : 1,
    stripThicknessMm: thickness,
    overlapMm: overlap,
    headrailType,
    installationType: installType,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const persistQuote = Boolean(body.confirmQuote || body.persistQuote)
    const validatedInput = validateRequestBody(body)

    const sessionClient = await createServerClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()

    const pricingClient = createPricingClient() || sessionClient

    const quote = await generateQuote(pricingClient, validatedInput, {
      persistQuote,
      createdBy: user?.id ?? null,
    })

    return NextResponse.json(quote)
  } catch (error) {
    const baseMessage = error instanceof Error ? error.message : 'Unable to process PVC calculation request.'
    const message = baseMessage.includes('Detected setting keys: none detected')
      ? `${baseMessage} If settings exist in Supabase, verify RLS/policies allow this API to read pvc_calculator_settings or configure SUPABASE_SERVICE_ROLE_KEY for server routes.`
      : baseMessage
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
