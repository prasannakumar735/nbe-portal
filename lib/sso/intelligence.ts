import { randomBytes, createHash } from 'node:crypto'

/** Must match the hashing NBE Intelligence uses to look the code back up (lib/sso/hash.ts there). */
export function hashSsoCode(rawCode: string): string {
  return createHash('sha256').update(rawCode).digest('hex')
}

/** Opaque, single-use, short-lived bearer code — never a Supabase JWT. */
export function generateSsoCode(): string {
  return randomBytes(32).toString('base64url')
}

export const SSO_CODE_TTL_SECONDS = 60
