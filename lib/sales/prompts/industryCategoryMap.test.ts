import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { inferIndustrySlugFromBusinessCategory } from '@/lib/sales/prompts/industryCategoryMap'

describe('inferIndustrySlugFromBusinessCategory', () => {
  it('maps gourmet and food manufacturer categories to food_processing', () => {
    assert.equal(inferIndustrySlugFromBusinessCategory('Agrelia Gourmet Co'), 'food_processing')
    assert.equal(inferIndustrySlugFromBusinessCategory('Food manufacturer'), 'food_processing')
    assert.equal(inferIndustrySlugFromBusinessCategory('Catering services'), 'food_processing')
  })

  it('still maps generic manufacturing when no food keywords', () => {
    assert.equal(inferIndustrySlugFromBusinessCategory('Metal manufacturing'), 'manufacturing')
  })
})
