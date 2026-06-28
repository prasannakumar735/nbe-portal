import type { PVCCalculatorSnapshotV1 } from '@/lib/pvc/pvcCalculatorSnapshot'
import { denormalizedFieldsFromSnapshot } from '@/lib/pvc/pvcCalculatorSnapshot'

/** Columns added by draft migration + total_price; avoids legacy/missing pvc_quotes columns. */
export function pvcQuoteDraftRowFromSnapshot(
  snapshot: PVCCalculatorSnapshotV1,
  options?: { createdBy?: string | null },
): Record<string, unknown> {
  const denorm = denormalizedFieldsFromSnapshot(snapshot)
  const row: Record<string, unknown> = {
    form_snapshot: snapshot,
    status: 'draft',
    workflow_status: 'draft_review',
    updated_at: new Date().toISOString(),
    customer_name: denorm.customer_name,
    ref_no: denorm.ref_no,
    site_address: denorm.site_address,
    quote_label: denorm.quote_label,
    total_price: denorm.total_price,
  }
  if (options?.createdBy) {
    row.created_by = options.createdBy
  }
  return row
}

export function pvcQuoteFinalizeRowFromPdf(quoteData: {
  calculated: { final_quote_price: number }
  customerDetails?: { customer?: string; refNo?: string; address?: string }
}): Record<string, unknown> {
  const customer = quoteData.customerDetails?.customer?.trim() || null
  const refNo = quoteData.customerDetails?.refNo?.trim() || null
  const siteAddress = quoteData.customerDetails?.address?.trim() || null

  return {
    status: 'finalized',
    total_price: quoteData.calculated.final_quote_price,
    customer_name: customer,
    ref_no: refNo,
    site_address: siteAddress,
    updated_at: new Date().toISOString(),
  }
}
