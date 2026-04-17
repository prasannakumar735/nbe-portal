import { z } from 'zod'

const requiredText = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)

const nullableText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform(value => {
      const next = String(value ?? '').trim()
      return next || null
    })

export const createClientSchema = z.object({
  client_name: requiredText('Client name'),
})

export const updateClientSchema = createClientSchema

export const createLocationSchema = z.object({
  client_id: z.string().uuid('Client is required'),
  location_name: requiredText('Location name'),
  Company_address: requiredText('Address', 500),
  suburb: nullableText(),
})

export const updateLocationSchema = createLocationSchema.omit({ client_id: true })

export const upsertDoorSchema = z.object({
  client_location_id: z.string().uuid('Location is required'),
  door_label: requiredText('Door label'),
  door_type: requiredText('Door type'),
  door_description: nullableText(1000),
  door_type_alt: nullableText(),
  cw: nullableText(120),
  ch: nullableText(120),
  install_date: z
    .string()
    .trim()
    .optional()
    .transform(value => {
      const next = String(value ?? '').trim()
      return next || null
    })
    .refine(value => !value || !Number.isNaN(Date.parse(value)), 'Install date must be a valid date'),
})

export const csvDoorRowSchema = z.object({
  client_name: requiredText('Client name'),
  location_name: requiredText('Location name'),
  door_label: requiredText('Door label'),
  door_type: requiredText('Door type'),
  door_description: nullableText(1000),
  door_type_alt: nullableText(),
  cw: nullableText(120),
  ch: nullableText(120),
  install_date: z
    .string()
    .trim()
    .optional()
    .transform(value => {
      const next = String(value ?? '').trim()
      return next || null
    })
    .refine(value => !value || !Number.isNaN(Date.parse(value)), 'Install date must be a valid date'),
})

export const csvDoorImportRequestSchema = z.object({
  createMissing: z.boolean().optional().default(false),
  rows: z.array(csvDoorRowSchema).max(5000, 'CSV import is limited to 5000 rows'),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type CreateLocationInput = z.infer<typeof createLocationSchema>
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>
export type UpsertDoorInput = z.infer<typeof upsertDoorSchema>
export type CsvDoorRowInput = z.infer<typeof csvDoorRowSchema>
export type CsvDoorImportRequestInput = z.infer<typeof csvDoorImportRequestSchema>
