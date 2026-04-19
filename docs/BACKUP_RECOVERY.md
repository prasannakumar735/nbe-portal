# Backup and recovery (Supabase)

Operational guide for the NBE Portal database hosted on Supabase. Confirm details for your **plan** and **region** in the [Supabase Dashboard](https://supabase.com/dashboard) and official docs—behavior varies by tier.

## How Supabase backups work

### Daily backups

On plans that include automated backups, Supabase takes **scheduled snapshots** of your database (often described as daily or periodic depending on plan). These are **full-database** restores: you pick a restore point from the backup list, not arbitrary row-level undo.

- **Where to verify:** Dashboard → **Project** → **Database** → **Backups** (wording may vary by UI version).
- **Document internally:** retention length, who may request a restore, and your **RTO/RPO** targets.

### Point-in-time recovery (PITR)

**PITR** (where available on paid plans) lets you restore to a **specific time** within a **retention window**, which narrows recovery point objective compared to daily snapshots alone.

- Enable PITR for production if your compliance or uptime requirements need it.
- Note the **retention period**; restores cannot go further back than that window.

### Application check

Run the read-only connectivity script (uses service role; keep keys server-side only):

```bash
npm run backup:check
```

Requires `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, plus `SUPABASE_SERVICE_ROLE_KEY`. It confirms the database is reachable and logs a server timestamp (via RPC `nbe_backup_health_ping` when migration `056_nbe_backup_health_ping.sql` is applied).

## Recovery steps

### Restore the database from the dashboard

1. **Stop or isolate traffic** to the app if you are recovering from corruption or suspected breach (see emergency checklist below).
2. Open **Supabase Dashboard** → **Database** → **Backups** / **Point in time recovery** (per your plan).
3. Choose **restore** to the same project or to a **new project/branch** (preferred for testing first).
4. After restore, verify **migration state** (`lib/db/migrations/`) and **RLS** policies match expectations.
5. **Auth:** Supabase Auth data may need to align with the restored DB; test login and token issuance. Document your org’s procedure if Auth and DB are restored separately.
6. Run **smoke tests**: login, one authenticated API call, one critical write path.

### Rotate API keys if compromised

If anon, service role, or other secrets may have been exposed:

1. In Supabase Dashboard, **rotate** the affected keys (JWT secret / API keys as applicable to your setup).
2. Update **Vercel** (or your host) environment variables and redeploy.
3. Invalidate long-lived tokens if your incident process requires it (e.g. forced re-login).
4. Audit **Upstash**, email, Turnstile, and other third-party keys listed in your deployment checklist.

## Emergency checklist

Use when you suspect a breach, active abuse, or need to halt damage before a full incident review.

| Action | Notes |
|--------|--------|
| **Disable or narrow API routes** | Temporarily block or restrict `/api/*` at the edge (e.g. maintenance mode, IP allowlist, or deploy a minimal build) per your runbook. |
| **Revoke tokens** | Rotate Supabase JWT/API keys; consider signing users out if session theft is suspected. |
| **Notify users** | If personal data or credentials were at risk, follow legal/comms guidance (breach notice, status page). |
| **Preserve evidence** | Export relevant logs (structured security logs, Sentry, Supabase logs) before mass deletion. |
| **Restore** | After containment, restore from backup/PITR to a safe point if data was altered. |

A shorter **checklist**-only companion lives in `docs/SUPABASE_BACKUP_RECOVERY.md`.
