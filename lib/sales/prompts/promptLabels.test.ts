import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatPromptDescriptionLabel,
  formatPromptSlotLabel,
  formatResolvedPromptLabel,
} from '@/lib/sales/prompts/promptLabels'

describe('promptLabels', () => {
  it('formats manager-facing slot labels without slugs', () => {
    const label = formatPromptSlotLabel({
      productSlug: 'pvc_strip_curtains',
      industrySlug: 'food_processing',
      useCaseSlug: 'initial_outreach',
    })
    assert.equal(label, 'PVC Strip Curtains – Food Processing – Initial outreach')
    assert.equal(label.includes('_'), false)
  })

  it('formats resolved prompt labels with version', () => {
    const label = formatResolvedPromptLabel({
      productSlug: 'rapid_roller_doors',
      industrySlug: 'warehousing',
      useCaseSlug: 'initial_outreach',
      version: 4,
    })
    assert.equal(label, 'Rapid Roller Doors – Warehousing – Initial outreach V4')
  })

  it('uses the same format for seed descriptions', () => {
    const label = formatPromptDescriptionLabel({
      productSlug: 'preventive_maintenance',
      industrySlug: 'cold_storage',
      useCaseSlug: 'initial_outreach',
    })
    assert.equal(label, 'Preventive Maintenance – Cold Storage – Initial outreach')
  })
})
