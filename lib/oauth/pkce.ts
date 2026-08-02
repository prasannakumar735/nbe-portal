import { createHash } from 'crypto'

/** RFC 7636 S256: BASE64URL(SHA256(code_verifier)) === code_challenge */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false
  const computed = createHash('sha256').update(codeVerifier).digest('base64url')
  return computed === codeChallenge
}
