import type { PVCStripType } from '@/lib/types/pvc.types'

/** Excel P25 grade codes: s, p, sf, pf */
export function excelStripGradeLabel(stripType: PVCStripType | string): string {
  switch (stripType) {
    case 'polar':
    case 'ribbed_polar':
      return 'Freezer Temp -30'
    case 'colour':
      return 'Coolroom Ambient Temp'
    case 'standard':
    case 'ribbed':
    default:
      return 'Coolroom Ambient Temp'
  }
}

/** Excel P28 profile codes: p, r, c, s */
export function excelStripProfileLabel(stripType: PVCStripType | string): string {
  switch (stripType) {
    case 'ribbed':
    case 'ribbed_polar':
      return 'Ribbed profile'
    case 'colour':
      return 'Coloured'
    case 'polar':
    case 'standard':
    default:
      return 'Smooth profile'
  }
}

/** Full text after "Strip Type " on the proposal PDF (matches legacy Excel layout). */
export function formatProposalStripTypeLine(stripType: PVCStripType | string): string {
  return `${excelStripGradeLabel(stripType)} ${excelStripProfileLabel(stripType)}`
}

export function formatProposalHeadrailLabel(headrailType: string): string {
  switch (headrailType.toLowerCase()) {
    case 'galvanized':
      return 'Galvinsed'
    case 'stainless':
      return 'Stainless Steel'
    case 'aluminium':
      return 'Aluminium'
    case 'plastic':
      return 'Plastic'
    default:
      return headrailType
  }
}
