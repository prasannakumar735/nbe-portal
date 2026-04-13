import { NextResponse } from 'next/server'
import { requireManagerOrAdmin } from '@/lib/users/staff'
import { generateClientPassword, resetClientPassword } from '@/lib/clients/service'
import { sendClientCredentialsEmail } from '@/lib/email/sendClientCredentialsEmail'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export const runtime = 'nodejs'

export async function POST(request: Request) {
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

  const id = String(body.id ?? '').trim()
  const autoGenerate = Boolean(body.auto_generate_password)
  const sendCredentials = Boolean(body.send_credentials)
  let password = String(body.password ?? '')
  const confirm = String(body.confirm_password ?? '')

  if (!id) {
    return NextResponse.json({ error: 'Client id is required.' }, { status: 400 })
  }

  if (autoGenerate) {
    password = generateClientPassword()
  }

  if (!autoGenerate) {
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    if (password !== confirm) {
      return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 })
    }
  }

  const reset = await resetClientPassword(id, password)
  if ('error' in reset) {
    return NextResponse.json({ error: reset.error }, { status: 400 })
  }

  const service = createServiceRoleClient()
  const { data: row } = await service
    .from('client_users')
    .select('email, name, company_name')
    .eq('id', id)
    .maybeSingle()

  const email = String(row?.email ?? '')
  const name = String(row?.name ?? '')
  const companyName = String(row?.company_name ?? '')

  const loginUrl = new URL('/client/login', new URL(request.url).origin).toString()
  let emailSent = false
  let emailError: string | undefined

  if (sendCredentials && email) {
    const send = await sendClientCredentialsEmail({
      to: email,
      clientName: name,
      companyName,
      loginUrl,
      email,
      password,
    })
    emailSent = send.sent
    emailError = send.error
  }

  return NextResponse.json({
    ok: true,
    plain_password: password,
    email_sent: emailSent,
    email_error: emailError,
  })
}
