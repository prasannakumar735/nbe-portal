import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EMPTY_SALES_AI_PROMPT_DEFINITION } from '@/lib/sales/types/aiPrompt.types'
import { validateSalesAiPromptForActivation } from '@/lib/sales/prompts/promptValidation'

const complete = {
  ...EMPTY_SALES_AI_PROMPT_DEFINITION,
  tone: 'professional',
  business_pain_points: ['Downtime'],
  value_proposition: 'Practical industrial advice.',
  cta: "If you'd like, we would be happy to arrange a no-obligation site assessment.",
  subject_line_guidance: 'Specific and professional.',
}

describe('validateSalesAiPromptForActivation', () => {
  it('accepts a complete structured prompt', () => {
    const result = validateSalesAiPromptForActivation(complete)
    assert.equal(result.ok, true)
    assert.deepEqual(result.errors, [])
  })

  it('rejects missing required sections', () => {
    const result = validateSalesAiPromptForActivation({
      ...EMPTY_SALES_AI_PROMPT_DEFINITION,
      tone: '',
      business_pain_points: [],
      value_proposition: '',
      cta: '',
      subject_line_guidance: '',
    })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((e) => e.includes('Tone')))
    assert.ok(result.errors.some((e) => e.includes('Pain Points')))
    assert.ok(result.errors.some((e) => e.includes('Value Proposition')))
    assert.ok(result.errors.some((e) => e.includes('CTA')))
    assert.ok(result.errors.some((e) => e.includes('Subject Guidance')))
  })

  it('rejects custom templates without known variables', () => {
    const result = validateSalesAiPromptForActivation({
      ...complete,
      user_prompt_template: 'Write an email with no placeholders.',
    })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((e) => e.includes('Variables')))
  })

  it('accepts custom templates with known variables', () => {
    const result = validateSalesAiPromptForActivation({
      ...complete,
      user_prompt_template: 'Write to {{company_name}} in {{suburb}}.',
    })
    assert.equal(result.ok, true)
  })
})
