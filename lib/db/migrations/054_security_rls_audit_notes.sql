-- 054 — Security audit notes (superseded by concrete policies in 055)
--
-- Apply **`055_rls_policies_zero_policy_tables.sql`** for JWT policies on tables that had RLS enabled but zero policies.
-- `password_reset_tokens` is intentionally unchanged here (server/service-role path; see 052/053).

SELECT 1;
