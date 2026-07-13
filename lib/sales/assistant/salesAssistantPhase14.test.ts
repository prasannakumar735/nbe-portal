import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseSalesAssistantModelOutput } from '@/lib/sales/assistant/parseAssistantResponse'
import { buildSalesAssistantUserPrompt } from '@/lib/sales/assistant/salesAssistantPrompts'

describe('parseSalesAssistantModelOutput', () => {
  it('parses JSON payload', () => {
    const raw = JSON.stringify({
      title: 'Reply summary',
      summary: 'Prospect asked for pricing.',
      sections: [],
      bulletActions: ['Schedule inspection'],
    })
    const parsed = parseSalesAssistantModelOutput(raw)
    assert.equal(parsed.title, 'Reply summary')
    assert.equal(parsed.bulletActions[0], 'Schedule inspection')
  })

  it('falls back to plain text', () => {
    const parsed = parseSalesAssistantModelOutput('Plain manager note')
    assert.match(parsed.summary, /Plain manager/)
  })
})

describe('buildSalesAssistantUserPrompt', () => {
  it('forbids auto-send in follow-up task copy', () => {
    const prompt = buildSalesAssistantUserPrompt({
      capability: 'recommend_followups',
      context: {
        business: null,
        contact: null,
        campaign: null,
        pipeline: null,
        engagement: null,
        recentEmails: [],
      },
    })
    assert.match(prompt, /Do NOT write a send-ready email/i)
  })
})
