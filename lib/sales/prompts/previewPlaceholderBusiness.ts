import type { SalesBusiness } from '@/lib/sales/types/business.types'

export function previewPlaceholderBusiness(category: string): SalesBusiness {
  const now = new Date().toISOString()
  return {
    id: '00000000-0000-0000-0000-000000000010',
    scan_run_id: null,
    company_name: 'Example Manufacturing Pty Ltd',
    address: '12 Industrial Drive',
    suburb: 'Dandenong',
    postcode: '3175',
    website: 'https://example.com.au',
    phone: null,
    category,
    source: 'manual',
    status: 'new',
    selected: false,
    last_contacted_at: null,
    contact_attempts: 0,
    raw_payload: null,
    scanned_at: null,
    created_at: now,
  }
}
