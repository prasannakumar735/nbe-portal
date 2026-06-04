import { z } from 'zod'
import { SERVICE_REMINDER_LEAD_TIME_DAYS } from '@/lib/serviceReminders/dueDate'

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(v => !Number.isNaN(Date.parse(`${v}T00:00:00`)), 'Invalid date')

const emailOptional = z
  .string()
  .trim()
  .max(320)
  .optional()
  .transform(v => {
    const s = String(v ?? '').trim()
    return s || null
  })
  .refine(v => v === null || (v.includes('@') && !v.includes(' ')), 'Invalid email')

export const createClientContactEmailSchema = z.object({
  client_id: z.string().uuid('Client is required'),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform(v => {
      const s = String(v ?? '').trim()
      return s || null
    }),
  email: z.string().trim().min(3).max(320).refine(v => v.includes('@') && !v.includes(' '), 'Invalid email'),
})

export const createServiceDueReminderSchema = z.object({
  client_id: z.string().uuid('Client is required'),
  client_location_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  notes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform(v => {
      const s = String(v ?? '').trim()
      return s || null
    }),
  last_service_date: isoDate.optional().nullable(),
  service_interval_months: z.coerce.number().int().positive().optional().nullable(),
  due_date: isoDate,
  lead_time_days: z.coerce
    .number()
    .int()
    .refine(
      (n): n is (typeof SERVICE_REMINDER_LEAD_TIME_DAYS)[number] =>
        (SERVICE_REMINDER_LEAD_TIME_DAYS as readonly number[]).includes(n),
      'Invalid lead time',
    ),
  send_manager_email: z.boolean().optional().default(true),
  send_client_email: z.boolean().optional().default(false),
  client_contact_email: emailOptional,
  client_contact_name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform(v => {
      const s = String(v ?? '').trim()
      return s || null
    }),
  client_contact_email_id: z.string().uuid().optional().nullable(),
})

export const updateServiceDueReminderSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .nullable()
    .transform(v => {
      if (v === undefined) return undefined
      const s = String(v ?? '').trim()
      return s || null
    }),
  due_date: isoDate.optional(),
  lead_time_days: z.coerce
    .number()
    .int()
    .optional()
    .refine(
      v => v === undefined || (SERVICE_REMINDER_LEAD_TIME_DAYS as readonly number[]).includes(v),
      'Invalid lead time',
    ),
  send_manager_email: z.boolean().optional(),
  send_client_email: z.boolean().optional(),
  client_contact_email: emailOptional.optional(),
  client_contact_name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform(v => {
      if (v === undefined) return undefined
      const s = String(v ?? '').trim()
      return s || null
    }),
  status: z.enum(['active', 'cancelled', 'done']).optional(),
})
