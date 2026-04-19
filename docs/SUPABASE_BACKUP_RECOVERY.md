# Supabase backup & recovery (checklist)

For narrative procedures (PITR, dashboard restore, key rotation, emergency steps), see **`docs/BACKUP_RECOVERY.md`**.

Use this as an operational checklist for the NBE Portal Postgres + Auth project on Supabase. Adjust retention to your compliance needs.

## 1. Platform backups (Supabase)

- **Point-in-time recovery (PITR)** — Available on paid plans; enables restore to a timestamp within the retention window. Confirm PITR is **enabled** for production and note the **retention period** in the Supabase dashboard.
- **Daily backups** — Supabase provides automated backups on supported tiers. Document:
  - Backup **frequency** and **retention**
  - **Region** where backups are stored
  - Who is allowed to **trigger a restore** (runbook + access control)

## 2. Logical exports (defense in depth)

- **SQL dump** — Periodic `pg_dump` (or Supabase CLI `db dump`) stored **off-Supabase** (encrypted object storage, separate account).
- **Auth** — User identities are managed by Supabase Auth; restoring a DB snapshot without matching Auth metadata can break sessions. For full DR, coordinate **database + Auth** restore procedures with Supabase documentation for your plan.

## 3. Application secrets

- Maintain an **offline** list of which secrets exist in Vercel (anon key, service role, Graph, Upstash, Turnstile, etc.) and a **rotation runbook** (order of rotation, smoke tests after).

## 4. Recovery drills

- At least annually: **restore to a non-production branch** or project and run critical path tests (login, one read/write API, one report).
- Record **RTO/RPO** targets and whether current backups meet them.

## 5. RLS and migrations

- After any restore, confirm **migration version** matches `lib/db/migrations/` and **RLS policies** are present (no tables left with “zero policy” unintentionally).

## 6. Verification (periodic)

Use this as a **read-only** checklist after configuring backups; it does not perform restores by itself.

| Check | How |
|--------|-----|
| Backups exist | Supabase Dashboard → **Database** → **Backups** (or plan-appropriate UI) — confirm latest backup timestamp. |
| PITR window | If enabled, note **retention** and test **restore to a branch** in a **non-production** project at least annually. |
| Dump restore | Restore a `pg_dump` to a scratch DB and run `SELECT` on critical tables + verify RLS (`pg_policies`). |
| Auth alignment | After DB-only restore, confirm Auth users still match expectations (or document re-invite process). |
| App smoke | From a restored environment: login, one API call with JWT, one write path you care about. |

This document is guidance only—not a substitute for Supabase support SLAs or organizational BCP.
