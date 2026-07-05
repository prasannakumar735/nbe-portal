import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPromptComparisonRows } from '@/lib/sales/prompts/promptComparison'
import { EMPTY_SALES_AI_PROMPT_DEFINITION } from '@/lib/sales/types/aiPrompt.types'
import type { SalesAiPrompt } from '@/lib/sales/types/aiPrompt.types'

function prompt(partial: Partial<SalesAiPrompt> & { version: number }): SalesAiPrompt {
  return {
    id: partial.id ?? `id-${partial.version}`,
    prompt_name: 'pvc_strip_curtains.general.initial_outreach',
    version: partial.version,
    product_slug: 'pvc_strip_curtains',
    industry_slug: 'general',
    use_case_slug: 'initial_outreach',
    campaign_type_id: null,
    definition: partial.definition ?? {
      ...EMPTY_SALES_AI_PROMPT_DEFINITION,
      tone: 'professional',
      business_pain_points: ['Downtime'],
      value_proposition: 'Value A',
      cta: 'Call us',
      subject_line_guidance: 'Be specific',
    },
    description: partial.description ?? null,
    is_active: partial.is_active ?? false,
    created_by: partial.created_by ?? null,
    created_at: partial.created_at ?? '2026-01-01T00:00:00.000Z',
  }
}

describe('buildPromptComparisonRows', () => {
  it('marks changed fields and includes required comparison columns', () => {
    const left = prompt({ version: 1 })
    const right = prompt({
      version: 2,
      definition: {
        ...EMPTY_SALES_AI_PROMPT_DEFINITION,
        tone: 'friendly',
        business_pain_points: ['Compliance'],
        value_proposition: 'Value B',
        cta: 'Book a visit',
        subject_line_guidance: 'Be specific',
        word_limit: 200,
      },
    })

    const rows = buildPromptComparisonRows(left, right)
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]))

    assert.ok(byKey.tone?.changed)
    assert.ok(byKey.pain_points?.changed)
    assert.ok(byKey.value_proposition?.changed)
    assert.ok(byKey.cta?.changed)
    assert.equal(byKey.subject_guidance?.changed, false)
    assert.ok(byKey.word_limit?.changed)
    assert.equal(byKey.global_rules?.changed, false)
    assert.ok(byKey.variables)

    assert.deepEqual(
      rows.map((r) => r.label),
      [
        'Tone',
        'Pain Points',
        'Value Proposition',
        'CTA',
        'Subject Guidance',
        'Word Limit',
        'Global Rules',
        'Variables',
        'Writing Style',
        'Target Audience',
        'Avoid',
      ],
    )
  })
})
