import type { PVCFormValues } from '@/app/(portal)/pvc-calculator/components/PVCForm'
import type { PVCQuoteLine } from '@/app/(portal)/pvc-calculator/pvcQuoteLines'
import { aggregateQuoteSupply } from '@/app/(portal)/pvc-calculator/pvcQuoteLines'

export type PVCCalculatorQuoteExtras = {
  installationPrice: number
  freightPrice: number
}

export type PVCCalculatorSnapshotV1 = {
  version: 1
  formValues: PVCFormValues
  quoteLines: PVCQuoteLine[]
  quoteExtras: PVCCalculatorQuoteExtras
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function finalPriceFromSnapshot(snapshot: PVCCalculatorSnapshotV1): number {
  const supply = aggregateQuoteSupply(snapshot.quoteLines, null)
  const installation = Number(snapshot.quoteExtras.installationPrice) || 0
  const freight = Number(snapshot.quoteExtras.freightPrice) || 0
  return round2(supply + installation + freight)
}

export function quoteLabelFromSnapshot(snapshot: PVCCalculatorSnapshotV1): string {
  const customer = snapshot.formValues.customer.trim()
  const sizeCount = snapshot.quoteLines.length
  const sizes = sizeCount === 1 ? '1 size' : `${sizeCount} sizes`
  if (customer) {
    return sizeCount > 0 ? `${customer} — ${sizes}` : customer
  }
  return sizeCount > 0 ? `PVC quote — ${sizes}` : 'PVC quote draft'
}

export function buildSnapshotV1(input: {
  formValues: PVCFormValues
  quoteLines: PVCQuoteLine[]
  quoteExtras: PVCCalculatorQuoteExtras
}): PVCCalculatorSnapshotV1 {
  return {
    version: 1,
    formValues: {
      ...input.formValues,
      doorType: input.formValues.doorType === 'strips_only' ? 'strips_only' : 'whole_door',
    },
    quoteLines: input.quoteLines,
    quoteExtras: {
      installationPrice: Number(input.quoteExtras.installationPrice) || 0,
      freightPrice: Number(input.quoteExtras.freightPrice) || 0,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Narrow persisted JSON at API boundary; throws on invalid shape. */
export function parsePVCCalculatorSnapshot(value: unknown): PVCCalculatorSnapshotV1 {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error('Invalid PVC calculator snapshot.')
  }
  if (!isRecord(value.formValues) || !Array.isArray(value.quoteLines) || !isRecord(value.quoteExtras)) {
    throw new Error('Invalid PVC calculator snapshot.')
  }
  const extras = value.quoteExtras
  if (!isFiniteNumber(extras.installationPrice) || !isFiniteNumber(extras.freightPrice)) {
    throw new Error('Invalid PVC calculator snapshot: quote extras.')
  }
  const snap = value as unknown as PVCCalculatorSnapshotV1
  return {
    ...snap,
    formValues: normalizeFormValuesDoorType(snap.formValues),
    quoteLines: snap.quoteLines.map(line => ({
      ...line,
      config: {
        ...line.config,
        doorType: line.config.doorType === 'strips_only' ? 'strips_only' : 'whole_door',
      },
    })),
  }
}

/** Ensure legacy snapshots default door type. */
export function normalizeFormValuesDoorType(formValues: PVCFormValues): PVCFormValues {
  return {
    ...formValues,
    doorType: formValues.doorType === 'strips_only' ? 'strips_only' : 'whole_door',
  }
}

export function denormalizedFieldsFromSnapshot(snapshot: PVCCalculatorSnapshotV1) {
  const fv = snapshot.formValues
  const first = snapshot.quoteLines[0]
  return {
    customer_name: fv.customer.trim() || null,
    ref_no: fv.refNo.trim() || null,
    site_address: fv.address.trim() || null,
    quote_label: quoteLabelFromSnapshot(snapshot),
    total_price: finalPriceFromSnapshot(snapshot),
    opening_width_mm: first?.config.width ?? fv.width,
    opening_height_mm: first?.config.height ?? fv.height,
    strip_type: first?.config.stripType ?? fv.stripType,
    strip_width_mm: first?.config.stripWidth ?? fv.stripWidth,
    thickness_mm: first?.config.thickness ?? fv.thickness,
    overlap_percent: first?.config.overlap ?? fv.overlap,
    headrail_type: first?.config.headrailType ?? fv.headrailType,
    installation_type: fv.installType,
    subtotal: first?.result.totals.subtotal ?? 0,
  }
}
