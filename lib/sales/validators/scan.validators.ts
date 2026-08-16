import { z } from 'zod'

export const AU_POSTCODE_REGEX = /^\d{4}$/

export const salesPostcodeSchema = z
  .string()
  .trim()
  .regex(AU_POSTCODE_REGEX, 'Postcode must be 4 digits')

export function parsePostcodesInput(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const unique: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const parsed = salesPostcodeSchema.safeParse(part)
    if (!parsed.success) {
      throw new Error(`Invalid postcode: ${part}`)
    }
    if (!seen.has(parsed.data)) {
      seen.add(parsed.data)
      unique.push(parsed.data)
    }
  }
  if (unique.length === 0) {
    throw new Error('Enter at least one postcode.')
  }
  if (unique.length > 10) {
    throw new Error('Maximum 10 postcodes per scan.')
  }
  return unique
}

export const discoveryScanBodySchema = z.object({
  postcodes: z
    .array(salesPostcodeSchema)
    .min(1, 'At least one postcode is required.')
    .max(10, 'Maximum 10 postcodes per scan.'),
  refreshFromGoogle: z.boolean().optional(),
})
