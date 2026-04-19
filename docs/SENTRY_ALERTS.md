# Sentry alerts for security signals

Structured security events are emitted as JSON logs (`logSecurityEvent` / helpers) and mirrored to Sentry as `captureMessage` with names like `security:rate_limit_exceeded` when a DSN is configured (see `lib/security/securitySentry.ts`). Use the following dashboard rules to turn those signals into actionable alerts without flooding on-call.

## 1. High rate limiting

**Goal:** Detect abusive or misconfigured clients hammering APIs.

- **Condition:** More than **20** events with message matching `security:rate_limit_exceeded` (or tag `security_event` = `rate_limit_exceeded`) in **1 minute**.
- **Filter:** Environment = production (and optionally staging separately).
- **Grouping:** Use **endpoint** / tag `endpoint` (derived from path) so one noisy route does not hide others.

## 2. Unauthorized spikes

**Goal:** Credential stuffing, broken integrations, or session issues.

- **Condition:** More than **20** events with `security_event` = `unauthorized_access` in a **short window** (e.g. 5–10 minutes), or use Sentry’s **Issue** volume if issues are grouped by fingerprint.
- **Grouping:** By **endpoint** (`endpoint` tag or path in `extra.path`).

## 3. Single-IP abuse

**Goal:** One client (masked IP bucket) driving most failures.

- **Approach A (Sentry Discover):** Build a query on `security:*` issues where `extra.ip_masked` is present; alert when the **same `ip_masked`** appears on more than **N** events in **15 minutes** (tune N per environment).
- **Approach B (log drain):** Ship JSON logs to your SIEM and alert on cardinality / top-N by `ip` (masked field) for `rate_limit_exceeded` or `unauthorized_access`.

Sentry’s built-in “same user” alerts are less applicable here because we intentionally **do not** send full IP as a user identifier; prefer **Discover** or external log analysis for IP-centric rules.

## Reducing noise

- Use **thresholds** (e.g. >20/min) so a single client retry does not page.
- **Group by endpoint** using the `endpoint` tag (path prefix) from security messages.
- Keep **separate** projects or environments for production vs staging to avoid test traffic triggering production rules.
- Set `SENTRY_SECURITY_EVENTS=0` only when you must disable Sentry mirroring entirely (logs still emit).
