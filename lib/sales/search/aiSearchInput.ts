import {
  BUSINESS_SEARCH_MAX_LIMIT,
  type BusinessSearchInput,
} from '@/lib/sales/search/businessSearch.types'
import { AU_POSTCODE_REGEX } from '@/lib/sales/validators/scan.validators'

export class BusinessSearchValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessSearchValidationError'
  }
}

const AU_STATE_CODES = new Set([
  'ACT',
  'NSW',
  'NT',
  'QLD',
  'SA',
  'TAS',
  'VIC',
  'WA',
])

export function validateBusinessSearchInput(raw: BusinessSearchInput): BusinessSearchInput {
  const postcode = raw.postcode.trim()
  const category = raw.category.trim()
  const state = raw.state.trim().toUpperCase()
  const limit = Math.trunc(raw.limit)
  const suburbRaw = raw.suburb?.trim()
  const suburb = suburbRaw ? suburbRaw : undefined

  if (!AU_POSTCODE_REGEX.test(postcode)) {
    throw new BusinessSearchValidationError('Postcode must be 4 digits.')
  }
  if (!category) {
    throw new BusinessSearchValidationError('Category is required.')
  }
  if (!state) {
    throw new BusinessSearchValidationError('State is required.')
  }
  if (!AU_STATE_CODES.has(state)) {
    throw new BusinessSearchValidationError('State must be a valid AU state or territory code.')
  }
  if (!Number.isFinite(limit) || limit < 1) {
    throw new BusinessSearchValidationError('Limit must be at least 1.')
  }
  if (limit > BUSINESS_SEARCH_MAX_LIMIT) {
    throw new BusinessSearchValidationError(
      `Limit must not exceed ${BUSINESS_SEARCH_MAX_LIMIT}.`,
    )
  }

  return { postcode, category, state, limit, suburb }
}
