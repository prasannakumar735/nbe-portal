/** Product lines for Prompt Library (independent of campaign UI labels). */

export const SALES_PRODUCT_LINE_SLUGS = [
  'pvc_strip_curtains',
  'rapid_roller_doors',
  'preventive_maintenance',
  'dock_doors',
] as const

export type SalesProductLineSlug = (typeof SALES_PRODUCT_LINE_SLUGS)[number]

export function isSalesProductLineSlug(value: string): value is SalesProductLineSlug {
  return (SALES_PRODUCT_LINE_SLUGS as readonly string[]).includes(value)
}

export const SALES_PRODUCT_LINE_LABELS: Record<SalesProductLineSlug, string> = {
  pvc_strip_curtains: 'PVC Strip Curtains',
  rapid_roller_doors: 'Rapid Roller Doors',
  preventive_maintenance: 'Preventive Maintenance',
  dock_doors: 'Dock Doors',
}
