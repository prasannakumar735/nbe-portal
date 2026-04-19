/**
 * Security smoke / penetration-style checks against a running server.
 * Does not replace a professional pentest. Run against local or staging only.
 *
 * Usage:
 *   npm run security:test
 *   BASE_URL=https://staging.example.com npm run security:test
 *
 * Optional (for RBAC / “wrong user” scenario):
 *   SECURITY_TEST_CLIENT_COOKIE — full `Cookie` header from a browser session whose
 *     `profiles.role` is **not** `admin`/`manager`/`field_staff` (e.g. `client`), so
 *     `POST /api/admin/clients` returns **403**.
 *
 * Requires Node 18+ (global fetch). TypeScript executed via `tsx`.
 */

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

function line(kind: 'PASS' | 'FAIL' | 'SKIP', message: string) {
  console.log(`[${kind}] ${message}`)
}

function mergeHeaders(init?: HeadersInit): Headers {
  const h = new Headers(init)
  h.set('x-nbe-security-test', 'harness')
  return h
}

async function testUnauthorizedAccess(): Promise<void> {
  const name = 'Unauthorized access blocked'
  try {
    const res = await fetch(`${BASE}/api/admin/clients`, {
      method: 'POST',
      headers: mergeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ client_name: 'SecurityTest' }),
    })
    if (res.status === 401) line('PASS', name)
    else line('FAIL', `${name} (got HTTP ${res.status}, expected 401)`)
  } catch (e) {
    line('FAIL', `${name} (${e instanceof Error ? e.message : String(e)})`)
  }
}

/** Authenticated as low-privilege user → admin API must not allow (403). */
async function testCrossUserRbac(): Promise<void> {
  const name = 'Cross-user / RBAC (forbidden for wrong role)'
  const cookie = process.env.SECURITY_TEST_CLIENT_COOKIE?.trim()
  if (!cookie) {
    line(
      'SKIP',
      `${name} — set SECURITY_TEST_CLIENT_COOKIE (session cookie for a non-manager user)`,
    )
    return
  }
  try {
    const res = await fetch(`${BASE}/api/admin/clients`, {
      method: 'POST',
      headers: mergeHeaders({
        'Content-Type': 'application/json',
        Cookie: cookie,
      }),
      body: JSON.stringify({ client_name: 'SecurityTestHarness' }),
    })
    if (res.status === 403) line('PASS', name)
    else
      line(
        'FAIL',
        `${name} (got HTTP ${res.status}, expected 403 — wrong role or cookie expired)`,
      )
  } catch (e) {
    line('FAIL', `${name} (${e instanceof Error ? e.message : String(e)})`)
  }
}

async function testRateLimit(): Promise<void> {
  const name = 'Rate limiting enforced (429)'
  const attempts = 18
  let saw429 = false
  try {
    for (let i = 0; i < attempts; i++) {
      const res = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: mergeHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: `security-test-${i}-${Date.now()}@example.com` }),
      })
      if (res.status === 429) {
        saw429 = true
        break
      }
    }
    if (saw429) line('PASS', name)
    else
      line(
        'FAIL',
        `${name} (no 429 after ${attempts} requests — tier may be high or window not exhausted)`,
      )
  } catch (e) {
    line('FAIL', `${name} (${e instanceof Error ? e.message : String(e)})`)
  }
}

async function testPayloadTooLarge(): Promise<void> {
  const name = 'Payload abuse rejected (413)'
  try {
    const pad = 'x'.repeat(40_000)
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: mergeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: 'a@b.com', password: 'x', _pad: pad }),
    })
    if (res.status === 413) line('PASS', name)
    else line('FAIL', `${name} (got HTTP ${res.status}, expected 413)`)
  } catch (e) {
    line('FAIL', `${name} (${e instanceof Error ? e.message : String(e)})`)
  }
}

async function testCaptchaBypass(): Promise<void> {
  const name = 'CAPTCHA enforced on login when configured'
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: mergeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        email: 'security-harness@example.com',
        password: 'not-the-real-password',
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }

    if (res.status === 400 && /captcha/i.test(String(json.error ?? ''))) {
      line('PASS', name)
      return
    }
    if (res.status === 401) {
      line(
        'SKIP',
        `${name} — Turnstile not enforced on server (got 401 invalid credentials; expected when TURNSTILE_* unset)`,
      )
      return
    }
    line('FAIL', `${name} (HTTP ${res.status}, body: ${JSON.stringify(json).slice(0, 120)})`)
  } catch (e) {
    line('FAIL', `${name} (${e instanceof Error ? e.message : String(e)})`)
  }
}

async function main() {
  console.log(`security-tests.ts → ${BASE}\n`)
  await testUnauthorizedAccess()
  await testCrossUserRbac()
  await testRateLimit()
  await testPayloadTooLarge()
  await testCaptchaBypass()
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
