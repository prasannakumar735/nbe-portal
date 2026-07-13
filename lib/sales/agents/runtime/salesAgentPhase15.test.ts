import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SALES_CORE_AGENT_IDS } from '@/lib/sales/agents/agent.types'
import {
  listSalesAgentDefinitions,
  resolveCoreAgentId,
} from '@/lib/sales/agents/runtime/salesAgentRegistry'

describe('salesAgentRegistry', () => {
  it('registers eight core agents', () => {
    const defs = listSalesAgentDefinitions()
    assert.equal(defs.length, SALES_CORE_AGENT_IDS.length)
    assert.equal(defs.length, 8)
  })

  it('maps legacy email_sending to queue', () => {
    assert.equal(resolveCoreAgentId('email_sending'), 'queue')
  })

  it('marks job-backed agents retryable', () => {
    const defs = listSalesAgentDefinitions()
    for (const def of defs) {
      assert.equal(def.retryable, true)
    }
  })
})
