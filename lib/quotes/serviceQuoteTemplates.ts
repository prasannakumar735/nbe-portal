import type { ServiceLineItem } from '@/components/quotes/types'
import { PVC_STRIP_QUOTE_LINE_MATERIAL_LABELS } from '@/lib/calculators/pvcPricingEngine'
import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'

/**
 * Preset line-item checklists driven by quote classification (type + sub-category).
 */
export const SERVICE_QUOTE_LINE_TEMPLATES: Record<string, string[]> = {
  '6 Month Service': [
    'Conducted scheduled service on rapid roller doors',
    'Inspected mechanical components',
    'Inspected electrical components',
    'Lubrication of moving parts',
    'Tension adjustments',
    'Safety sensor inspection',
    'Operational test',
  ],
  'Annual Service': [
    'Completed annual full service and condition report',
    'Checked limit settings and alignment',
    'Inspected motors, chain, and drive components',
    'Checked control panel and safety circuit',
    'Lubrication of moving parts',
    'Safety sensor inspection',
    'Operational test',
  ],
  'Door Breakdown Repair': [
    'Attended site for rapid door breakdown repair',
    'Diagnosed fault and isolated root cause',
    'Carried out repairs and adjustments',
    'Safety checks completed',
    'Operational test',
  ],
  'Photo Cell Replacement': [
    'Removed faulty photo cells',
    'Installed new photo cells',
    'Aligned and calibrated sensor operation',
    'Operational test',
  ],
  'Motor Replacement': [
    'Removed faulty rapid door motor',
    'Installed replacement motor',
    'Checked limits and drive alignment',
    'Operational test',
  ],
  'Side Leg Replacement': [
    'Removed damaged side leg assembly',
    'Installed replacement side leg',
    'Aligned curtain travel and guides',
    'Operational test',
  ],
  'Curtain Replacement': [
    'Site attendance and safe isolation of door',
    'Measured opening and verified replacement curtain specification',
    'Removed damaged rapid door curtain',
    'Supplied and installed replacement curtain',
    'Re-tensioned and aligned curtain travel',
    'Inspected guides, bottom bar, and wind locks as applicable',
    'Safety checks and operational test',
  ],
  'Top Section Replacement': [
    'Site attendance and safe isolation of door',
    'Removed damaged top section / hood assembly',
    'Supplied and installed replacement top section',
    'Realigned and secured fixings and interfaces',
    'Inspected curtain entry and seals',
    'Safety checks and operational test',
  ],
  'Drive System Replacement': [
    'Diagnosed drive system fault',
    'Removed faulty drive / gearbox components as required',
    'Supplied and installed replacement drive system parts',
    'Set limits, chain tension, and torque per manufacturer',
    'Lubricated moving parts where applicable',
    'Safety checks and operational test',
  ],
  'Safety Edge Replacement': [
    'Removed faulty safety edge',
    'Installed replacement safety edge',
    'Terminated and tested safety circuit',
    'Verified control panel / inverter recognition',
    'Safety checks and operational test',
  ],
  'Other Parts Replacement': [
    'Site attendance for replacement work as quoted',
    'Removed faulty component(s)',
    'Supplied and installed replacement part(s)',
    'Recommissioned door and verified operation',
    'Recorded serials / part references where applicable',
  ],
  /** Same line labels as PVC Strip Calculator PDF material breakdown (quantities from calculator or site measure). */
  'PVC Curtain (Strip Door)': [...PVC_STRIP_QUOTE_LINE_MATERIAL_LABELS],
  /** Scope aligned with typical PVC swing door quotations (unit + install + optional demo). */
  'PVC Swing Door': [
    'PVC Swingdoor — supply per item code / schedule (pair or single; record model e.g. SWD-2400WD)',
    'Mounting, panel specification, spring type, MDF crate / packaging — per quotation',
    'Opening width (mm) and height (mm) — confirm on site',
    'Installation',
    'Demolishing existing door (optional)',
  ],
  'Control Box Installation': [
    'Rapid door control box / inverter — supply per specification',
    'Safe isolation and removal of existing control gear (as required)',
    'Install and secure new control enclosure',
    'Terminate power, motor, and field devices per wiring diagram',
    'Program limits, safety inputs, and operating parameters',
    'Commission, safety verification, and operational handover test',
  ],
}

/** Maps persisted taxonomy slugs → key in `SERVICE_QUOTE_LINE_TEMPLATES`. */
const TAXONOMY_TO_TEMPLATE_KEY: Record<string, string> = {
  'service:6_month_service': '6 Month Service',
  'service:annual_service': 'Annual Service',
  'repair:general_door_repair': 'Door Breakdown Repair',
  'parts_replacement:curtain': 'Curtain Replacement',
  'parts_replacement:uprights': 'Side Leg Replacement',
  'parts_replacement:top_section': 'Top Section Replacement',
  'parts_replacement:drive_system': 'Drive System Replacement',
  'parts_replacement:motor': 'Motor Replacement',
  'parts_replacement:photo_cell': 'Photo Cell Replacement',
  'parts_replacement:safety_edge': 'Safety Edge Replacement',
  'parts_replacement:other_parts': 'Other Parts Replacement',
  'new_installation:pvc_curtain': 'PVC Curtain (Strip Door)',
  'new_installation:pvc_swing_door': 'PVC Swing Door',
  'new_installation:control_box': 'Control Box Installation',
}

export function serviceTemplateKeyForTaxonomy(
  quoteType: string,
  quoteSubCategory: string,
): string | null {
  const type = String(quoteType ?? '').trim().toLowerCase()
  const sub = String(quoteSubCategory ?? '').trim().toLowerCase()
  const mapKey = `${type}:${sub}`
  const templateKey = TAXONOMY_TO_TEMPLATE_KEY[mapKey]
  if (!templateKey || !SERVICE_QUOTE_LINE_TEMPLATES[templateKey]) return null
  return templateKey
}

export function lineItemsFromServiceTemplateKey(templateKey: string): ServiceLineItem[] {
  const lines = SERVICE_QUOTE_LINE_TEMPLATES[templateKey]
  if (!lines?.length) return []
  return lines.map(description => ({
    description,
    width: '',
    height: '',
    qty: 1,
    unitPrice: 0,
  }))
}

/** Line items for this taxonomy when a preset exists; otherwise `null` (leave rows as-is). */
export function lineItemsForTaxonomy(
  quoteType: QuoteTypeSlug,
  quoteSubCategory: string,
): ServiceLineItem[] | null {
  const key = serviceTemplateKeyForTaxonomy(quoteType, quoteSubCategory)
  if (!key) return null
  return lineItemsFromServiceTemplateKey(key)
}
