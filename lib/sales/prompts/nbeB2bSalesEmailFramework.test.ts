import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  NBE_BANNED_PHRASES,
  NBE_EMAIL_STRUCTURE,
  formatNbeFrameworkSystemBrief,
  formatNbeFrameworkUserSections,
  formatNbeProductGuidance,
  formatNbeTechnicalAccuracyBlock,
} from '@/lib/sales/prompts/nbeB2bSalesEmailFramework'

describe('nbeB2bSalesEmailFramework', () => {
  it('includes five-part email structure', () => {
    assert.equal(NBE_EMAIL_STRUCTURE.length, 5)
    assert.ok(NBE_EMAIL_STRUCTURE[0].title.includes('Personalised'))
    assert.ok(NBE_EMAIL_STRUCTURE[4].title.toLowerCase().includes('cta'))
  })

  it('lists banned marketing phrases', () => {
    assert.ok(NBE_BANNED_PHRASES.includes('Act now'))
    assert.ok(NBE_BANNED_PHRASES.includes('Industry-leading'))
    assert.ok(NBE_BANNED_PHRASES.includes('I wanted to reach out'))
  })

  it('formats system brief with NBE consultative role', () => {
    const text = formatNbeFrameworkSystemBrief()
    assert.ok(text.includes('NBE Australia'))
    assert.ok(text.includes('Australian English'))
  })

  it('formats product and user framework sections', () => {
    const product = formatNbeProductGuidance('pvc_strip_curtains')
    assert.ok(product.includes('temperature loss'))

    const user = formatNbeFrameworkUserSections({
      productSlug: 'rapid_roller_doors',
      industrySlug: 'warehousing',
    })
    assert.ok(user.includes('NBE email structure'))
    assert.ok(user.includes('Final validation'))
    assert.ok(user.includes('forklift traffic'))
    assert.ok(user.includes('Technical accuracy'))
  })

  it('requires qualified language for savings claims', () => {
    const block = formatNbeTechnicalAccuracyBlock()
    assert.ok(block.includes('Save 50% on energy'))
    assert.ok(block.includes('Can help reduce'))
    assert.ok(block.includes('verified customer data'))
  })
})
