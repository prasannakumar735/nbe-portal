import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hasLineTotalOverride,
  lineItemRowTotal,
  parseLineTotalOverride,
  sanitizeServiceLineItemForSnapshot,
} from './lineItemTotal'
import { normalizeServiceLineItemForTest } from './serviceQuoteSnapshot'

describe('parseLineTotalOverride', () => {
  it('returns undefined for empty / null / NaN', () => {
    assert.equal(parseLineTotalOverride(undefined), undefined)
    assert.equal(parseLineTotalOverride(null), undefined)
    assert.equal(parseLineTotalOverride(''), undefined)
    assert.equal(parseLineTotalOverride(Number.NaN), undefined)
  })

  it('returns finite numbers including zero', () => {
    assert.equal(parseLineTotalOverride(2138.81), 2138.81)
    assert.equal(parseLineTotalOverride(0), 0)
    assert.equal(parseLineTotalOverride('100.5'), 100.5)
  })
})

describe('lineItemRowTotal', () => {
  it('uses qty × unit when no override', () => {
    assert.equal(lineItemRowTotal({ qty: 2, unitPrice: 50 }), 100)
  })

  it('uses override when set', () => {
    assert.equal(lineItemRowTotal({ qty: 1, unitPrice: 250, totalOverride: 199 }), 199)
  })

  it('ignores null override (bug case)', () => {
    assert.equal(
      lineItemRowTotal({ qty: 1, unitPrice: 2138.81, totalOverride: null }),
      2138.81,
    )
  })
})

describe('hasLineTotalOverride', () => {
  it('is false for null', () => {
    assert.equal(hasLineTotalOverride({ totalOverride: null }), false)
  })

  it('is true for zero override', () => {
    assert.equal(hasLineTotalOverride({ totalOverride: 0 }), true)
  })
})

describe('normalizeServiceLineItemForTest', () => {
  it('does not set totalOverride when snapshot had null', () => {
    const line = normalizeServiceLineItemForTest({
      description: 'PVC',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 100,
      totalOverride: null,
    })
    assert.equal('totalOverride' in line && line.totalOverride !== undefined, false)
  })
})

describe('sanitizeServiceLineItemForSnapshot', () => {
  it('strips override equal to computed within epsilon', () => {
    const line = sanitizeServiceLineItemForSnapshot({
      description: 'Freight',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 250,
      totalOverride: 250,
    })
    assert.equal(line.totalOverride, undefined)
  })
})
