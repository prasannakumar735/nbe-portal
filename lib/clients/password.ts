import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash)
}

/** Strong random password suitable for one-time handoff */
export function generateClientPassword(): string {
  const part = randomBytes(18).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  return `Nbe-${part}1!`
}
