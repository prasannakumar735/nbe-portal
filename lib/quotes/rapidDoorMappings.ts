// UI code → PDF description mappings for Industrial Rapid Door quotes

export const INDICATOR_LAMP_OPTIONS = ['AMB', 'LED', 'RYG'] as const
export const INDICATOR_LAMP_MAP: Record<string, string> = {
  AMB: '(Amber Strobe Light)',
  LED: '(LED Traffic Light)',
  RYG: '(RYG Signal Tower)',
}

export const SAFETY_SENSOR_OPTIONS = ['PEC', 'SLC'] as const
export const SAFETY_SENSOR_MAP: Record<string, string> = {
  PEC: '(Dual-Photocell)',
  SLC: '(Safety Light Curtain)',
}

// Safety Edge is a fixed single value when selected
export const SAFETY_EDGE_DISPLAY = '(Airbag Sensor)'

export const PUSH_BUTTON_OPTIONS = ['PB01', 'PB02', 'PB05'] as const
export const PUSH_BUTTON_MAP: Record<string, string> = {
  PB01: '(1PB)',
  PB02: '(2PB)',
  PB05: '(5PB)',
}

export const RADAR_OPTIONS = ['STANDARD', 'FALCON', 'CONDOR', 'W-SCAN'] as const
export const RADAR_MAP: Record<string, string> = {
  STANDARD: '(NBE Standard)',
  FALCON:   '(BEA Falcon)',
  CONDOR:   '(BEA Condor)',
  'W-SCAN': '(BEA Wide Scan)',
}

export const REMOTE_CONTROL_OPTIONS = ['R/C-4J', 'R/C-4', 'R/C-8', 'R/C-16'] as const
export const REMOTE_CONTROL_MAP: Record<string, string> = {
  'R/C-4J': '(NBE Basic 4CH)',
  'R/C-4':  '(Elsema 4CH)',
  'R/C-8':  '(Elsema 8CH)',
  'R/C-16': '(Elsema 16CH)',
}

export const INDUCTION_LOOP_OPTIONS = ['I/L AMP', 'I/L FULL'] as const
export const INDUCTION_LOOP_MAP: Record<string, string> = {
  'I/L AMP':  '(Amplifire Only)',
  'I/L FULL': '(Full Installation)',
}

// "SWIPE" category shown as "Other" in the PDF
export const SWIPE_OPTIONS = ['SWIPE', 'P-CORD', 'K-SWITCH', 'RFID', 'I-LOCK', 'UPS', 'A/C'] as const
export const SWIPE_MAP: Record<string, string> = {
  SWIPE:      '(Touchless Button)',
  'P-CORD':   '(Pull Cord)',
  'K-SWITCH': '(Key Switch)',
  RFID:       '(RFID)',
  'I-LOCK':   '(Interlock)',
  UPS:        '(UPS)',
  'A/C':      '(Air Curtain)',
}

export const DOOR_CONTROL_OPTIONS = ['ENC', 'LS'] as const
export const DOOR_CONTROL_MAP: Record<string, string> = {
  ENC: 'Encoder',
  LS:  'Limit Switch',
}

export const FRAME_DISPLAY_MAP: Record<string, string> = {
  GAL:   'Galvanised',
  'P/C': 'Powder Coated',
  'S/S': 'Stainless Steel',
}

export const CURTAIN_DISPLAY_MAP: Record<string, string> = {
  PVC900: 'PVC 900 gsm',
  INSUL:  'Insulated',
  FRZ:    'Freezer',
  MESH:   'Mesh (Option)',
}

export const COLOUR_DISPLAY_MAP: Record<string, string> = {
  'BL 543': 'Blue 543',
  'RD 356': 'Red 356',
  'YL 119': 'Yellow 119',
  'OR 244': 'Orange 244',
  'GR 679': 'Green 679',
  'GY 729': 'Grey 729',
  TBC:      'TBC',
}

/** Lookup helper — returns mapped value or '-' if key empty/missing */
export function mapOrDash(map: Record<string, string>, key: string | undefined): string {
  if (!key || key === '-') return '-'
  return map[key] ?? key
}
