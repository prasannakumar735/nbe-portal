export type MaintenanceChecklistStatus = 'good' | 'caution' | 'fault' | 'na'

export type MaintenanceChecklistItem = {
  code: string
  section: string
  label: string
  floating_note?: string
}

export const MAINTENANCE_CHECKLIST_ITEMS: MaintenanceChecklistItem[] = [
  { code: 'a01', section: 'A. CURTAIN', label: 'Curtain runs smooth and aligned?' },
  { code: 'a02', section: 'A. CURTAIN', label: 'Any damage or wear to fabrics?' },
  { code: 'a03', section: 'A. CURTAIN', label: 'Any bends or cracks in stiffeners?' },
  { code: 'a04', section: 'A. CURTAIN', label: 'View window clear free of cracks or damage?' },
  { code: 'a05', section: 'A. CURTAIN', label: 'Any cuts or wear on straps?' },
  { code: 'b06', section: 'B. DOOR FRAME', label: 'Any damage or rust to frame or curtain guides?' },
  { code: 'b07', section: 'B. DOOR FRAME', label: 'Any dents rust or damage to drum cover?' },
  { code: 'b08', section: 'B. DOOR FRAME', label: 'All fixtures tightened securely?' },
  { code: 'b09', section: 'B. DOOR FRAME', label: 'Any visible damage to cables?' },
  { code: 'c10', section: 'C. OPEN / CLOSE FUNCTION', label: 'Curtain seals properly to floor?' },
  { code: 'c11', section: 'C. OPEN / CLOSE FUNCTION', label: 'Hazard or traffic lights working properly?' },
  { code: 'c12', section: 'C. OPEN / CLOSE FUNCTION', label: 'Doors fully open and close in manual mode?' },
  { code: 'c13', section: 'C. OPEN / CLOSE FUNCTION', label: 'Doors fully open and close in auto mode?' },
  { code: 'c14', section: 'C. OPEN / CLOSE FUNCTION', label: 'Interlock functioning correctly where applicable?' },
  { code: 'c15', section: 'C. OPEN / CLOSE FUNCTION', label: 'Push button works properly?' },
  { code: 'c16', section: 'C. OPEN / CLOSE FUNCTION', label: 'Sensors remote induction loop radar working?' },
  { code: 'd17', section: 'D. SAFETY & CONTROL BOX', label: 'Photoelectric cell sensors working properly?' },
  { code: 'd18', section: 'D. SAFETY & CONTROL BOX', label: 'Safety edge functions properly?' },
  { code: 'd19', section: 'D. SAFETY & CONTROL BOX', label: 'Emergency switch operates properly?' },
  { code: 'd20', section: 'D. SAFETY & CONTROL BOX', label: 'Control box door closes and lock functions?' },
  { code: 'd21', section: 'D. SAFETY & CONTROL BOX', label: 'All wires secured and covered in conduit?' },
  { code: 'e22', section: 'E. DRIVE SYSTEM & MOTOR', label: 'Gearbox free of oil leaks and abnormal wear?' },
  { code: 'e23', section: 'E. DRIVE SYSTEM & MOTOR', label: 'Any signs of wear in drive system?' },
  { code: 'e24', section: 'E. DRIVE SYSTEM & MOTOR', label: 'Bearings free of rust or wear?' },
  { code: 'e25', section: 'E. DRIVE SYSTEM & MOTOR', label: 'Limit switch or encoder function correctly?' },
  { code: 'e26', section: 'E. DRIVE SYSTEM & MOTOR', label: 'Chain or belt properly adjusted and lubricated?' },
]

export const MAINTENANCE_CHECKLIST_ITEMS_NEW: MaintenanceChecklistItem[] = [
  {
    code: 'a01',
    section: 'A. CURTAIN',
    label: 'Movement – Runs smooth, aligned, parallel?',
    floating_note: 'Ensure the curtain runs smoothly, symmetrically, and parallel to the door frame.',
  },
  {
    code: 'a02',
    section: 'A. CURTAIN',
    label: 'Fabric – Any cuts, holes, or wear?',
    floating_note: 'Check for any cuts, holes, or heavily worn areas (inside / outside).',
  },
  {
    code: 'a03',
    section: 'A. CURTAIN',
    label: 'Stiffener – Any bends, cracks, or damage?',
    floating_note: 'Inspect for bends, cracks, or any damage to the stiffeners and end clamps.',
  },
  {
    code: 'a04',
    section: 'A. CURTAIN',
    label: 'View Window – Clear and free of damage?',
    floating_note: 'Check the welding and assess the percentage of visibility.',
  },
  {
    code: 'a05',
    section: 'A. CURTAIN',
    label: 'Straps/Buckles (CAD/FR) – Any wear or damage?',
    floating_note: 'Ensure there are no cuts or wear on the straps and no damage to the buckles.',
  },
  {
    code: 'b06',
    section: 'B. DOOR FRAME',
    label: 'Frame and Cover – Any dent, rust or damage?',
    floating_note: 'Inspect for dent or damage to purlins, side sheets.',
  },
  {
    code: 'b07',
    section: 'B. DOOR FRAME',
    label: 'PE Guides – Any damage, wear or bend?',
    floating_note: 'Inspect for any bent or damage for PE sheet.',
  },
  {
    code: 'b08',
    section: 'B. DOOR FRAME',
    label: 'Fixings – All secure and tight?',
    floating_note: 'Ensure all bolts are tight and inspect for any damage to the wall or floor fixings.',
  },
  {
    code: 'b09',
    section: 'B. DOOR FRAME',
    label: 'Cables – Undamaged and properly secured?',
    floating_note:
      'Make sure cables are properly secured, free from obstructions, and clear of the motor, drive drum, and curtains.',
  },
  {
    code: 'c10',
    section: 'C. OPEN / CLOSE FUNCTION',
    label: 'Floor Seal – Curtain sealing properly to the floor?',
    floating_note: 'Verify that the bottom of the curtain seals properly to the floor.',
  },
  {
    code: 'c11',
    section: 'C. OPEN / CLOSE FUNCTION',
    label: 'Lights – Hazard/traffic lights working?',
    floating_note: 'Ensure they are functioning correctly, with one on the door frame and one on the control box.',
  },
  {
    code: 'c12',
    section: 'C. OPEN / CLOSE FUNCTION',
    label: 'Manual Mode – Fully open and close?',
    floating_note: 'Confirm that the doors can fully open and close manually.',
  },
  {
    code: 'c13',
    section: 'C. OPEN / CLOSE FUNCTION',
    label: 'Auto Mode – Fully open and close?',
    floating_note: 'Confirm that the doors can fully open and close automatically.',
  },
  {
    code: 'c14',
    section: 'C. OPEN / CLOSE FUNCTION',
    label: 'Interlock – Functioning correctly (if applicable)?',
    floating_note: 'If applicable, test whether the interlock is functioning properly.',
  },
  {
    code: 'c15',
    section: 'C. OPEN / CLOSE FUNCTION',
    label: 'Push Button – Working properly?',
    floating_note: 'Check if the push button is working properly',
  },
  {
    code: 'c16',
    section: 'C. OPEN / CLOSE FUNCTION',
    label: 'Sensors – Remote, loop, radar working?',
    floating_note: 'Test the remote control, induction loop, and radar sensors',
  },
  {
    code: 'd17',
    section: 'D. SAFETY & CONTROL BOX',
    label: 'Photo Cells / Light Curtain – Operating correctly?',
    floating_note: 'Ensure the sensors are functioning properly.',
  },
  {
    code: 'd18',
    section: 'D. SAFETY & CONTROL BOX',
    label: 'Safety Edge – Functioning properly?',
    floating_note: 'Verify the proper functionality of the sensor.',
  },
  {
    code: 'd19',
    section: 'D. SAFETY & CONTROL BOX',
    label: 'Emergency Stop – Operating correctly?',
    floating_note: 'Check that the emergency switch is operating correctly.',
  },
  {
    code: 'd20',
    section: 'D. SAFETY & CONTROL BOX',
    label: 'Control Box – Door and lock working?',
    floating_note: 'Inspect for dents or fixture damage; ensure the door closes properly and the lock functions correctly.',
  },
  {
    code: 'd21',
    section: 'D. SAFETY & CONTROL BOX',
    label: 'Wiring – Secured and protected?',
    floating_note: 'Confirm that all cables are secured in place with no visible wear.',
  },
  {
    code: 'e22',
    section: 'E. DRIVE SYSTEM & MOTOR',
    label: 'Gearbox – Free of leaks and abnormal wear?',
    floating_note: 'Check for oil leaks and measure wear between the drive drums and gearbox.',
  },
  {
    code: 'e23',
    section: 'E. DRIVE SYSTEM & MOTOR',
    label: 'Drive System – Any signs of wear?',
    floating_note: 'Measure wear between the drive drums and gearbox.',
  },
  {
    code: 'e24',
    section: 'E. DRIVE SYSTEM & MOTOR',
    label: 'Bearings – Free of rust or wear?',
    floating_note: 'Inspect the visual condition for signs of rust or wear.',
  },
  {
    code: 'e25',
    section: 'E. DRIVE SYSTEM & MOTOR',
    label: 'Limit System – Switch/encoder working?',
    floating_note: 'Check chain adjustment and lubricate as needed.',
  },
  {
    code: 'e26',
    section: 'E. DRIVE SYSTEM & MOTOR',
    label: 'Chain/Belt – Adjusted and lubricated?',
    floating_note: 'Adjust, lubricate, and inspect contacts.',
  },
]

export type MaintenanceDoorPhoto = {
  url: string
  path: string
  /** Present when photo was captured offline and not yet uploaded. */
  offline_data_url?: string
  offline_content_type?: string
  offline_filename?: string
}

/** Copied from `doors` when the technician selects a door; stored on the report row for stable PDFs. */
export type DoorMasterSnapshot = {
  door_description?: string | null
  door_type_alt?: string | null
  cw?: string | null
  ch?: string | null
}

export type MaintenanceDoorForm = {
  door_id?: string
  local_id: string
  door_number: string
  door_type: string
  door_cycles: number
  view_window_visibility: number
  notes: string
  /** Freeform details for this inspection (separate from fault notes and global report notes). Schema >= 2 only. */
  technician_door_details?: string
  /** Snapshot from door registry when linked; schema >= 2 only. */
  door_master?: DoorMasterSnapshot | null
  /** Technician chose "Add door manually" — no registry row yet; label/master fields are entered on form. */
  adhoc_manual?: boolean
  checklist: Record<string, MaintenanceChecklistStatus | null>
  photos: MaintenanceDoorPhoto[]
  isCollapsed?: boolean
}

export type MaintenanceFormValues = {
  report_id?: string
  /**
   * `1` = legacy reports (no door master UI / PDF blocks).
   * `2` = new reports with optional door master snapshot + technician door details.
   * `3` = new checklist question text and PDF export wording.
   */
  report_schema_version?: number
  /** Client-generated UUID to make offline sync idempotent. */
  offline_id?: string
  technician_name: string
  submission_date: string
  source_app: string
  client_id: string
  client_location_id: string
  address: string
  inspection_date: string
  inspection_start: string
  inspection_end: string
  total_doors: number
  notes: string
  signature_data_url: string
  signature_storage_url: string
  doors: MaintenanceDoorForm[]
}

export type ClientOption = {
  id: string
  name: string
}

export type ClientLocationOption = {
  id: string
  client_id: string
  name: string
  address: string
  suburb?: string | null
}

/** Row from GET /api/maintenance/doors for dropdown + master snapshot. */
export type MaintenanceAvailableDoor = {
  id: string
  door_label: string
  door_type: string
  door_description?: string | null
  door_type_alt?: string | null
  cw?: string | null
  ch?: string | null
}

export type ClientRecord = {
  id: string
  client_name: string
  created_at?: string | null
}

export type ClientLocationRecord = {
  id: string
  client_id: string
  location_name: string
  Company_address: string | null
  suburb?: string | null
  created_at?: string | null
}

export type DoorRecord = {
  id: string
  client_location_id: string
  door_label: string
  door_type: string
  door_description?: string | null
  door_type_alt?: string | null
  cw?: string | null
  ch?: string | null
  install_date?: string | null
  created_at?: string | null
}

export type MaintenanceDraftPayload = {
  report_id?: string
  status: 'draft' | 'submitted'
  form: MaintenanceFormValues
}

/** POST /api/maintenance/merge-reports */
export type MergeMaintenanceReportsBody = {
  reportIds: string[]
  /** Stored on merged_reports; not rendered as a separate summary PDF page */
  totalDoorsInspected: number
}
