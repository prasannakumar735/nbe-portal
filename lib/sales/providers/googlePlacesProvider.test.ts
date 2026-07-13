import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseAustralianFormattedAddress } from '@/lib/sales/providers/googlePlacesProvider'

describe('parseAustralianFormattedAddress', () => {
  it('extracts street and suburb from VIC address', () => {
    const { address, suburb } = parseAustralianFormattedAddress(
      '12 Industrial Dr, Derrimut VIC 3030, Australia',
      '3030',
    )
    assert.equal(address, '12 Industrial Dr')
    assert.equal(suburb, 'Derrimut')
  })

  it('returns full first line when suburb cannot be parsed', () => {
    const line = 'Warehouse 5'
    const { address, suburb } = parseAustralianFormattedAddress(line, '3000')
    assert.equal(address, line)
    assert.equal(suburb, '')
  })
})
