export type MaintenanceChecklistStatus = 'good' | 'caution' | 'fault' | 'na'

export type MaintenanceChecklistItem = {
  code: string
  section: string
  label: string
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

export type MaintenanceDoorPhoto = {
  url: string
  path: string
  /** Present when photo was captured offline and not yet uploaded. */
  offline_data_url?: string
  offline_content_type?: string
  offline_filename?: string
}

export type MaintenanceDoorForm = {
  door_id?: string
  local_id: string
  door_number: string
  door_type: string
  door_cycles: number
  view_window_visibility: number
  notes: string
  checklist: Record<string, MaintenanceChecklistStatus | null>
  photos: MaintenanceDoorPhoto[]
  isCollapsed?: boolean
}

export type MaintenanceFormValues = {
  report_id?: string
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
