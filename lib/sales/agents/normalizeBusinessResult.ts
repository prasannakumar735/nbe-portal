import type { BusinessResult, SalesBusinessInsert } from '@/lib/sales/types/business.types'

export function normalizeBusinessResultForInsert(
  result: BusinessResult,
  scanRunId: string,
): SalesBusinessInsert {
  return {
    scan_run_id: scanRunId,
    company_name: result.company_name.trim(),
    address: result.address.trim(),
    suburb: result.suburb.trim(),
    postcode: result.postcode.trim(),
    website: result.website?.trim() || null,
    phone: result.phone?.trim() || null,
    category: result.category.trim(),
    source: result.source,
    status: 'new',
    selected: false,
    contact_attempts: 0,
    last_contacted_at: null,
    raw_payload: result.raw_payload,
  }
}
