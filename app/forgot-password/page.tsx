import { headers } from 'next/headers'
import { ForgotPasswordClient } from './ForgotPasswordClient'

export default async function ForgotPasswordPage() {
  const h = await headers()
  const cspNonce = (typeof h?.get === 'function' ? h.get('x-nonce') : null) ?? ''
  return <ForgotPasswordClient cspNonce={cspNonce} />
}
