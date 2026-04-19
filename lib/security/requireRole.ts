import type { ProfileFromTable } from '@/lib/auth/roles'

import { ForbiddenError } from './errors'

/**
 * Strict RBAC: assert `profiles.role` is one of `roles` (from DB/JWT-backed profile — never from the request body).
 *
 * @throws {ForbiddenError} — map to HTTP 403 in route handlers (`httpAuthErrors` / `ForbiddenError`).
 */
export function requireRole(profile: ProfileFromTable | null | undefined, roles: readonly string[]): void {
  const r = String(profile?.role ?? '').trim()
  if (!r || !roles.includes(r)) {
    throw new ForbiddenError('Forbidden')
  }
}
