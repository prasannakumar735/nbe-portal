import { NextRequest, NextResponse } from 'next/server'
import { requireManagerOrAdmin } from '@/lib/users/staff'
import { createClientUser, generateClientPassword } from '@/lib/clients/service'
import { sendClientCredentialsEmail } from '@/lib/email/sendClientCredentialsEmail'
import type { ClientUserStatus } from '@/lib/types/client-users.types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const companyName = String(body.company_name ?? '').trim()
  const clientId = String(body.client_id ?? '').trim()
  const email = String(body.email ?? '').trim()
  const autoGenerate = Boolean(body.auto_generate_password)
  const sendCredentials = Boolean(body.send_credentials)
  const status: ClientUserStatus = body.status === 'disabled' ? 'disabled' : 'active'

  let password = String(body.password ?? '')
  const confirm = String(body.confirm_password ?? '')

  if (autoGenerate) {
    password = generateClientPassword()
  }

  if (!autoGenerate && password !== confirm) {
    return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 })
  }

  if (!clientId) {
    return NextResponse.json(
      { error: 'Organisation (client_id) is required — pick the maintenance client this login may view reports for.' },
      { status: 400 }
    )
  }

  const result = await createClientUser({
    name,
    companyName,
    email,
    plainPassword: password,
    status,
    clientId,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const loginUrl = new URL('/client/login', request.nextUrl.origin).toString()
  let emailSent = false
  let emailError: string | undefined

  if (sendCredentials) {
    const send = await sendClientCredentialsEmail({
      to: result.client.email,
      clientName: result.client.name,
      companyName: result.client.company_name,
      loginUrl,
      email: result.client.email,
      password: result.plainPassword,
    })
    emailSent = send.sent
    emailError = send.error
  }

  return NextResponse.json({
    client: result.client,
    /** Only returned once — never stored client-side after dismiss */
    plain_password: result.plainPassword,
    email_sent: emailSent,
    email_error: emailError,
  })
}
