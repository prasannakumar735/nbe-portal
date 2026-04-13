import { z } from 'zod'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'

export const checklistStatusSchema = z.enum(['good', 'caution', 'fault', 'na'])

const checklistSchema = z.record(z.string(), checklistStatusSchema.nullable())

const photoSchema = z.object({
  // Online photos use http(s) URLs; offline photos use data URLs.
  url: z.string().min(1, 'Invalid photo URL'),
  path: z.string().min(1),
  offline_data_url: z.string().optional(),
  offline_content_type: z.string().optional(),
  offline_filename: z.string().optional(),
})

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
  checklist: checklistSchema,
  photos: z.array(photoSchema).default([]),
  isCollapsed: z.boolean().optional(),
})

/** Structural validation only — incomplete checklist and door/total mismatch allowed (draft save). */
export const maintenanceFormDraftSchema = z.object({
  report_id: z.string().uuid().optional(),
  offline_id: z.string().uuid().optional(),
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

const submitFormRefinements = (values: z.infer<typeof maintenanceFormDraftSchema>, ctx: z.RefinementCtx) => {
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
export const maintenanceFormSubmitSchema = maintenanceFormDraftSchema.superRefine(submitFormRefinements)

/** Same as `maintenanceFormSubmitSchema` — used by RHF and submit flows. */
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
    if (data.mode === 'draft') {
      status = 'draft'
    } else if (data.mode === 'submit') {
      status = 'submitted'
    }
    const { mode: _mode, ...rest } = data
    return { ...rest, status }
  })

export type MaintenanceDraftPayload = Omit<z.infer<typeof maintenanceDraftEnvelopeSchema>, 'form'> & {
  form: z.infer<typeof maintenanceFormSubmitSchema>
}

/** Draft API body: relaxed form validation when saving as draft; strict when submitting or reviewing. */
export function parseMaintenanceDraftPayload(body: unknown): MaintenanceDraftPayload {
  const envelope = maintenanceDraftEnvelopeSchema.parse(body)
  const useStrictValidation =
    envelope.status === 'submitted' || envelope.status === 'reviewing'

  const form = (useStrictValidation ? maintenanceFormSubmitSchema : maintenanceFormDraftSchema).parse(envelope.form)

  return { ...envelope, form }
}

export type MaintenanceFormSchema = z.infer<typeof maintenanceFormSubmitSchema>
export type MaintenanceDraftSchema = MaintenanceDraftPayload
