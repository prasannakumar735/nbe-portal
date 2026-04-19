import { headers } from 'next/headers'
import { ForgotPasswordClient } from './ForgotPasswordClient'

export default async function ForgotPasswordPage() {
  const cspNonce = (await headers()).get('x-nonce') ?? ''
  return <ForgotPasswordClient cspNonce={cspNonce} />
}
