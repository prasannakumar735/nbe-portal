import type { PVCCalculationResponse } from '@/lib/types/pvc.types'

export interface QuoteCalculatorInput {
  width_mm: number
  height_mm: number
  strip_type: string
  strip_width_mm: number
  thickness_mm: number
  overlap_mm: number
  headrail_type: string
  install_type: string
}

export interface QuoteCalculatedValues {
  strip_count: number
  strip_length_mm: number
  strip_meters: number
  pvc_strip_cost: number
  headrail_cost: number
  bracket_cost: number
  fittings_cost: number
  packaging_cost: number
  labour_cost: number
  subtotal: number
  markup_percent: number
  final_quote_price: number
}

export interface ProposalCustomerDetails {
  customer?: string
  attn?: string
  address?: string
  date?: string
  refNo?: string
}

export interface ProposalDoor {
  width_mm: number
  height_mm: number
  overlap_mm: number
  strip_width_mm: number
  thickness_mm: number
  strip_type: string
  headrail_type: string
  number_of_strips: number
  final_door_price: number
  strip_type_label?: string
}

export interface QuoteData {
  input: QuoteCalculatorInput
  calculated: QuoteCalculatedValues
  result: PVCCalculationResponse
  customerDetails?: ProposalCustomerDetails
  doors?: ProposalDoor[]
  freightCost?: number
  installationCost?: number
}

export interface QuoteGenerateRequest {
  quoteData: QuoteData
}

export interface QuoteGenerateResponse {
  pdfUrl: string | null
  pdfBase64?: string
  fileName: string
  quoteId: string | null
  audit: {
    oneDrive: {
      status: 'uploaded' | 'skipped' | 'failed'
      uploadPath: string
      webUrl: string | null
      reason?: string
    }
    email: {
      status: 'sent' | 'skipped' | 'failed'
      to: string
      reason?: string
    }
    database: {
      status: 'inserted' | 'skipped' | 'failed'
      quoteId: string | null
      reason?: string
    }
  }
}
