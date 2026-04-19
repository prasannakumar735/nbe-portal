#!/usr/bin/env node
/**
 * Lightweight penetration-style checks against a running app (local or staging).
 * Does not replace a professional pentest — use for smoke-testing defenses.
 *
 * Usage:
 *   BASE_URL=https://your-host node scripts/security-pen-test.mjs
 *   BASE_URL=http://localhost:3000 node scripts/security-pen-test.mjs
 *
 * Safe: only sends HTTP requests; no destructive DB operations.
 */

const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

const tests = [
  {
    name: 'login oversized JSON (should 413 or 400)',
    run: async () => {
      const body = 'x'.repeat(40_000)
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(body.length) },
        body: JSON.stringify({ email: 'a@b.com', password: 'x', _pad: body }),
      }).catch(() => null)
      return res ? res.status : 0
    },
  },
  {
    name: 'login invalid JSON shape',
    run: async () => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"not":"valid"',
      })
      return res.status
    },
  },
  {
    name: 'forgot-password empty email body',
    run: async () => {
      const res = await fetch(`${base}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      return res.status
    },
  },
]

async function main() {
  console.log(`security-pen-test → ${base}\n`)
  for (const t of tests) {
    try {
      const status = await t.run()
      console.log(`[${status}] ${t.name}`)
    } catch (e) {
      console.log(`[ERR] ${t.name}`, e instanceof Error ? e.message : e)
    }
  }
  console.log('\nDone. Review status codes and server security logs.')
}

main()
