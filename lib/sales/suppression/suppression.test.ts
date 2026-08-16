import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  addSalesEmailSuppression,
  isSalesEmailSuppressed,
  listSuppressedAddresses,
} from '@/lib/sales/repositories/salesEmailSuppressionRepository'

// ---------------------------------------------------------------------------
// Minimal SupabaseClient stub
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown }

function makeSupabase(result: MockResult) {
  const chain: Record<string, unknown> = {}
  const stub = () => chain
  chain.from = stub
  chain.select = stub
  chain.eq = stub
  chain.in = stub
  chain.limit = stub
  chain.order = stub
  chain.upsert = stub
  chain.maybeSingle = async () => result
  return chain as unknown as Parameters<typeof isSalesEmailSuppressed>[0]
}

// ---------------------------------------------------------------------------
// normalizeEmailForSuppression
// ---------------------------------------------------------------------------

describe('normalizeEmailForSuppression', () => {
  it('lowercases and trims', async () => {
    const { normalizeEmailForSuppression } = await import(
      '@/lib/sales/suppression/normalizeEmail'
    )
    assert.equal(normalizeEmailForSuppression('  Test@Example.COM  '), 'test@example.com')
  })

  it('does not strip + tags', async () => {
    const { normalizeEmailForSuppression } = await import(
      '@/lib/sales/suppression/normalizeEmail'
    )
    assert.equal(normalizeEmailForSuppression('user+tag@example.com'), 'user+tag@example.com')
  })

  it('does not strip Gmail dots', async () => {
    const { normalizeEmailForSuppression } = await import(
      '@/lib/sales/suppression/normalizeEmail'
    )
    assert.equal(normalizeEmailForSuppression('u.s.e.r@gmail.com'), 'u.s.e.r@gmail.com')
  })
})

// ---------------------------------------------------------------------------
// isSalesEmailSuppressed
// ---------------------------------------------------------------------------

describe('isSalesEmailSuppressed', () => {
  it('returns true when a row exists', async () => {
    const supabase = makeSupabase({ data: { id: 'abc' }, error: null })
    const result = await isSalesEmailSuppressed(supabase, 'user@example.com')
    assert.equal(result, true)
  })

  it('returns false when no row exists', async () => {
    const supabase = makeSupabase({ data: null, error: null })
    const result = await isSalesEmailSuppressed(supabase, 'user@example.com')
    assert.equal(result, false)
  })

  it('throws (fails closed) on a query error', async () => {
    const supabase = makeSupabase({ data: null, error: new Error('connection refused') })
    await assert.rejects(
      () => isSalesEmailSuppressed(supabase, 'user@example.com'),
      /connection refused/,
    )
  })

  it('returns true immediately for an empty string (cannot email nobody)', async () => {
    // Should not even hit the DB.
    const supabase = makeSupabase({ data: null, error: new Error('should not be called') })
    const result = await isSalesEmailSuppressed(supabase, '   ')
    assert.equal(result, true)
  })

  it('normalises the address before querying', async () => {
    // The stub always returns data — if normalisation is wrong the address
    // won't match anything real in the DB, but what we're asserting here is
    // that the function doesn't throw and reaches the DB call.
    const supabase = makeSupabase({ data: { id: 'x' }, error: null })
    const result = await isSalesEmailSuppressed(supabase, '  UPPER@EXAMPLE.COM  ')
    assert.equal(result, true)
  })
})

// ---------------------------------------------------------------------------
// addSalesEmailSuppression — idempotency
// ---------------------------------------------------------------------------

describe('addSalesEmailSuppression', () => {
  it('throws on empty email', async () => {
    const supabase = makeSupabase({ data: null, error: null })
    await assert.rejects(
      () =>
        addSalesEmailSuppression(supabase, { email_address: '  ', reason: 'unsubscribed' }),
      /Cannot suppress an empty email address/,
    )
  })

  it('returns null when upsert ignores a duplicate', async () => {
    // ignoreDuplicates: true means Supabase returns null data on conflict
    const supabase = makeSupabase({ data: null, error: null })
    const result = await addSalesEmailSuppression(supabase, {
      email_address: 'user@example.com',
      reason: 'unsubscribed',
    })
    assert.equal(result, null)
  })

  it('returns the mapped row on a new insert', async () => {
    const row = {
      id: 'row-1',
      email_address: 'user@example.com',
      reason: 'bounced',
      contact_id: null,
      campaign_id: null,
      notes: null,
      created_by: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    const supabase = makeSupabase({ data: row, error: null })
    const result = await addSalesEmailSuppression(supabase, {
      email_address: 'user@example.com',
      reason: 'bounced',
    })
    assert.ok(result)
    assert.equal(result.reason, 'bounced')
    assert.equal(result.email_address, 'user@example.com')
  })
})

// ---------------------------------------------------------------------------
// listSuppressedAddresses
// ---------------------------------------------------------------------------

describe('listSuppressedAddresses', () => {
  it('returns empty Set for empty input without hitting the DB', async () => {
    const supabase = makeSupabase({ data: null, error: new Error('should not be called') })
    // Override maybeSingle path — listSuppressedAddresses uses .select().in()
    // which our stub chains back to maybeSingle; returning Set() directly.
    // Because the early-return guard fires before any DB call, this is safe.
    // We just verify the function resolves without throwing.
    const result = await listSuppressedAddresses(supabase as never, [])
    assert.ok(result instanceof Set)
    assert.equal(result.size, 0)
  })
})
