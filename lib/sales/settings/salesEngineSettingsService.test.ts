import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildSalesEngineSettingsSnapshot,
  resolveOutboundRecipient,
} from '@/lib/sales/settings/salesEngineSettingsService'
import { getDefaultSalesEngineSettingValues } from '@/lib/sales/settings/salesEngineSettingDefinitions'

describe('salesEngineSettingsService', () => {
  it('passes through recipient when safe delivery disabled', () => {
    const snapshot = buildSalesEngineSettingsSnapshot(getDefaultSalesEngineSettingValues())
    const result = resolveOutboundRecipient(snapshot, 'john@customer.com')
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.resolved.intendedRecipient, 'john@customer.com')
      assert.equal(result.resolved.actualRecipient, 'john@customer.com')
      assert.equal(result.resolved.safeDeliveryActive, false)
    }
  })

  it('redirects when safe delivery enabled with valid email', () => {
    const raw = {
      ...getDefaultSalesEngineSettingValues(),
      'safe_delivery.enabled': true,
      'safe_delivery.redirect_email': 'pilot@example.com',
    }
    const snapshot = buildSalesEngineSettingsSnapshot(raw)
    const result = resolveOutboundRecipient(snapshot, 'john@customer.com')
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.resolved.intendedRecipient, 'john@customer.com')
      assert.equal(result.resolved.actualRecipient, 'pilot@example.com')
      assert.equal(result.resolved.safeDeliveryActive, true)
    }
  })

  it('fails when safe delivery enabled without redirect', () => {
    const raw = {
      ...getDefaultSalesEngineSettingValues(),
      'safe_delivery.enabled': true,
      'safe_delivery.redirect_email': '',
    }
    const snapshot = buildSalesEngineSettingsSnapshot(raw)
    const result = resolveOutboundRecipient(snapshot, 'john@customer.com')
    assert.equal(result.ok, false)
  })
})
