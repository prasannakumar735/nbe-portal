import { z, type ZodError, type ZodIssue } from 'zod'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'

export const checklistStatusSchema = z.enum(['good', 'caution', 'fault', 'na'])

const checklistSchema = z.record(z.string(), checklistStatusSchema.nullable())

/** Checklist on draft save may be sparse; values are null until set. */
const checklistDraftSchema = z.record(z.string(), checklistStatusSchema.nullable())

const photoSchema = z.object({
  // Online photos use http(s) URLs; offline photos use data URLs.
  url: z.string().min(1, 'Invalid photo URL'),
  path: z.string().min(1),
  offline_data_url: z.string().optional(),
  offline_content_type: z.string().optional(),
  offline_filename: z.string().optional(),
})

const photoDraftSchema = z.object({
  url: z.string().optional().default(''),
  path: z.string().optional().default(''),
  offline_data_url: z.string().optional(),
  offline_content_type: z.string().optional(),
  offline_filename: z.string().optional(),
})

const doorMasterSchema = z
  .object({
    door_description: z.string().nullable().optional(),
    door_type_alt: z.string().nullable().optional(),
    cw: z.string().nullable().optional(),
    ch: z.string().nullable().optional(),
  })
  .optional()
  .nullable()

/** Full door row — final submit / admin. */
const doorSchema = z.object({
  door_id: z.string().uuid().optional(),
  local_id: z.string().min(1),
  door_number: z.string().min(1, 'Door number is required'),
  door_type: z.string().min(1, 'Door type is required'),
  door_cycles: z.coerce.number().int('Door cycles must be a whole number').min(0, 'Door cycles must be 0 or greater'),
  view_window_visibility: z.coerce
    .number()
    .int('View window visibility must be a whole number')
    .min(0, 'View window visibility must be between 0 and 100')
    .max(100, 'View window visibility must be between 0 and 100'),
  notes: z.string().optional().default(''),
  technician_door_details: z.string().optional().default(''),
  door_master: doorMasterSchema,
  adhoc_manual: z.boolean().optional(),
  checklist: checklistSchema,
  photos: z.array(photoSchema).default([]),
  isCollapsed: z.boolean().optional(),
})

/** Partial / in-progress door — autosave and draft API (never block save). */
const doorDraftSchema = z.object({
  door_id: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .transform(v => (v === '' ? undefined : v)),
  local_id: z.string().min(1),
  door_number: z.string().optional().default(''),
  door_type: z.string().optional().default(''),
  door_cycles: z.coerce.number().int().optional().default(0),
  view_window_visibility: z.coerce.number().int().min(0).max(100).optional().default(0),
  notes: z.string().optional().default(''),
  technician_door_details: z.string().optional().default(''),
  door_master: doorMasterSchema,
  adhoc_manual: z.boolean().optional(),
  checklist: checklistDraftSchema.default(() => ({})),
  photos: z.array(photoDraftSchema).default([]),
  isCollapsed: z.boolean().optional(),
})

const formHeaderDraft = {
  report_id: z.string().uuid().optional(),
  offline_id: z.string().uuid().optional(),
  report_schema_version: z.coerce.number().int().min(1).max(99).optional(),
  /** Allow empty on draft; server/report row can still default. */
  technician_name: z.string().optional().default(''),
  submission_date: z.string().optional().default(''),
  source_app: z.string().default('Portal'),
  /** Accept any string; invalid UUIDs are normalized to '' server-side / before submit. */
  client_id: z.string().optional().default(''),
  client_location_id: z.string().optional().default(''),
  address: z.string().max(255).optional().default(''),
  inspection_date: z.string().optional().default(''),
  inspection_start: z.string().optional().default(''),
  inspection_end: z.string().optional().default(''),
  total_doors: z.coerce
    .number()
    .int('Total doors must be a whole number')
    .min(1, 'Total doors inspected is required and must be at least 1')
    .max(50, 'Total doors inspected cannot exceed 50'),
  notes: z.string().optional().default(''),
  signature_data_url: z.string().optional().default(''),
  signature_storage_url: z.string().optional().default(''),
}

/**
 * Lenient validation for the maintenance form in the portal and for draft saves.
 * Incomplete doors, checklist, and identifiers are allowed so partial data is never discarded.
 */
export const maintenanceFormDraftSchema = z.object({
  ...formHeaderDraft,
  doors: z.array(doorDraftSchema),
})

const submitFormRefinements = (values: z.infer<typeof maintenanceFormSubmitSchema>, ctx: z.RefinementCtx) => {
  if (values.doors.length !== values.total_doors) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Door sections must match total doors inspected',
      path: ['doors'],
    })
  }

  const requiredChecklistCodes = new Set(MAINTENANCE_CHECKLIST_ITEMS.map(item => item.code))

  values.doors.forEach((door, doorIndex) => {
    requiredChecklistCodes.forEach(code => {
      if (!door.checklist[code]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Checklist item ${code} must be completed`,
          path: ['doors', doorIndex, 'checklist', code],
        })
      }
    })
  })

  const start = new Date(`1970-01-01T${values.inspection_start}:00`)
  const end = new Date(`1970-01-01T${values.inspection_end}:00`)
  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Inspection end time must be after start time',
      path: ['inspection_end'],
    })
  }
}

/** Final submission / admin review — full checklist and cross-field rules. */
export const maintenanceFormSubmitSchema = z
  .object({
    report_id: z.string().uuid().optional(),
    offline_id: z.string().uuid().optional(),
    report_schema_version: z.coerce.number().int().min(1).max(99).optional(),
    technician_name: z.string().min(1, 'Technician name is required'),
    submission_date: z.string().min(1),
    source_app: z.string().default('Portal'),
    client_id: z.string().uuid('Client is required'),
    client_location_id: z.string().uuid('Location is required'),
    address: z.string().max(255).optional(),
    inspection_date: z.string().min(1, 'Inspection date is required'),
    inspection_start: z.string().min(1, 'Start time is required'),
    inspection_end: z.string().min(1, 'End time is required'),
    total_doors: z.coerce
      .number()
      .int('Total doors must be a whole number')
      .min(1, 'Total doors inspected is required and must be at least 1')
      .max(50, 'Total doors inspected cannot exceed 50'),
    notes: z.string().optional().default(''),
    signature_data_url: z.string().optional().default(''),
    signature_storage_url: z.string().optional().default(''),
    doors: z.array(doorSchema),
  })
  .superRefine(submitFormRefinements)

/** Alias used by submit API routes — strict validation. */
export const maintenanceFormSchema = maintenanceFormSubmitSchema

const maintenanceDraftEnvelopeSchema = z
  .object({
    report_id: z.string().uuid().optional(),
    status: z.enum(['draft', 'submitted', 'reviewing']).default('draft'),
    /** Explicit save mode: overrides `status` when set (`draft` | `submit`). */
    mode: z.enum(['draft', 'submit']).optional(),
    form: z.unknown(),
    admin_edit: z.boolean().optional().default(false),
  })
  .transform(data => {
    let status = data.status
    // Legacy: `mode: 'submit'` meant “finalize” in older clients. Do not map `mode: 'draft'` → force draft
    // (that overwrote `reviewing` and paired with `mode: 'submit'` on non-draft targets it promoted WIP to `submitted`).
    if (data.mode === 'submit') {
      status = 'submitted'
    }
    const { mode: _mode, ...rest } = data
    return { ...rest, status }
  })

export type MaintenanceDraftPayload = Omit<z.infer<typeof maintenanceDraftEnvelopeSchema>, 'form'> & {
  form: z.infer<typeof maintenanceFormDraftSchema>
}

/**
 * Draft API envelope: always parse `form` with the lenient draft schema so autosave / reviewing / offline sync never
 * blocks on incomplete checklists. Callers that persist `status: 'submitted'` must run `maintenanceFormSubmitSchema`
 * in the route (after this) or pre-validate (e.g. `/api/maintenance/submit`).
 */
export function parseMaintenanceDraftPayload(body: unknown): MaintenanceDraftPayload {
  const envelope = maintenanceDraftEnvelopeSchema.parse(body)
  const form = maintenanceFormDraftSchema.parse(envelope.form)
  return { ...envelope, form }
}

export type MaintenanceFormSchema = z.infer<typeof maintenanceFormSubmitSchema>
export type MaintenanceDraftSchema = MaintenanceDraftPayload

/** Strip non-UUID location/client ids after a lenient draft parse (store null in DB). */
export function uuidOrEmpty(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return z.string().uuid().safeParse(s).success ? s : ''
}

/** User-facing summary for maintenance form validation (submit + API errors). */
export function formatMaintenanceZodIssues(error: ZodError | Pick<ZodError, 'issues'>): string {
  const issues = 'issues' in error ? error.issues : []
  const top: string[] = []
  const byDoor = new Map<number, string[]>()

  for (const issue of issues as ZodIssue[]) {
    const path = issue.path
    if (path[0] === 'doors' && typeof path[1] === 'number') {
      const di = path[1]
      const list = byDoor.get(di) ?? []
      list.push(issue.message)
      byDoor.set(di, list)
    } else {
      top.push(issue.message)
    }
  }

  const doorLines = [...byDoor.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([di, msgs]) => `Door ${di + 1}: ${[...new Set(msgs)].join('; ')}`)

  return [...top, ...doorLines].filter(Boolean).join('\n')
}
