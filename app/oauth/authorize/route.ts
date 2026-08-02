import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { isManagerOrAdminRole } from '@/lib/auth/roles'
import { generateAuthorizationCode, storeAuthorizationCode } from '@/lib/oauth/tokens'

type OAuthClientRow = {
  client_id: string
  client_name: string
  redirect_uris: string[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function badRequest(message: string) {
  return NextResponse.json({ error: 'invalid_request', error_description: message }, { status: 400 })
}

async function loadClient(clientId: string): Promise<OAuthClientRow | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()
  return (data as OAuthClientRow | null) ?? null
}

function renderConsentPage(params: {
  clientName: string
  formAction: string
  hiddenFields: Record<string, string>
}) {
  const hidden = Object.entries(params.hiddenFields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('\n      ')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Authorize ${escapeHtml(params.clientName)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 20px; }
  p { color: #555; line-height: 1.5; }
  .actions { display: flex; gap: 12px; margin-top: 24px; }
  button { flex: 1; padding: 10px 16px; border-radius: 8px; border: 1px solid #ccc; font-size: 15px; cursor: pointer; }
  button[name="action"][value="allow"] { background: #111; color: #fff; border-color: #111; }
</style>
</head>
<body>
  <h1>Authorize ${escapeHtml(params.clientName)}</h1>
  <p>This will let <strong>${escapeHtml(params.clientName)}</strong> calculate NBE PVC strip curtain quotes on your behalf, using live pricing. It cannot save quotes or access anything else in the portal.</p>
  <form method="POST" action="${escapeHtml(params.formAction)}">
    ${hidden}
    <div class="actions">
      <button type="submit" name="action" value="deny">Deny</button>
      <button type="submit" name="action" value="allow">Allow</button>
    </div>
  </form>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const params = url.searchParams

  const responseType = params.get('response_type')
  const clientId = params.get('client_id')
  const redirectUri = params.get('redirect_uri')
  const codeChallenge = params.get('code_challenge')
  const codeChallengeMethod = params.get('code_challenge_method') || 'S256'
  const state = params.get('state') || ''
  const scope = params.get('scope') || ''

  if (responseType !== 'code') return badRequest('response_type must be "code".')
  if (!clientId) return badRequest('client_id is required.')
  if (!redirectUri) return badRequest('redirect_uri is required.')
  if (!codeChallenge) return badRequest('code_challenge is required (PKCE is mandatory).')
  if (codeChallengeMethod !== 'S256') return badRequest('code_challenge_method must be S256.')

  const client = await loadClient(clientId)
  if (!client) return badRequest('Unknown client_id.')
  if (!client.redirect_uris.includes(redirectUri)) return badRequest('redirect_uri is not registered for this client.')

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    const next = `${url.pathname}${url.search}`
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = String((profile as { role?: string } | null)?.role ?? '').trim()

  if (!isManagerOrAdminRole(role)) {
    return NextResponse.json(
      { error: 'access_denied', error_description: 'Only admin/manager accounts can authorize this connector.' },
      { status: 403 },
    )
  }

  const html = renderConsentPage({
    clientName: client.client_name,
    formAction: `${url.origin}/oauth/authorize`,
    hiddenFields: {
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state,
      scope,
    },
  })

  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const action = String(form.get('action') || '')
  const clientId = String(form.get('client_id') || '')
  const redirectUri = String(form.get('redirect_uri') || '')
  const codeChallenge = String(form.get('code_challenge') || '')
  const codeChallengeMethod = String(form.get('code_challenge_method') || 'S256')
  const state = String(form.get('state') || '')
  const scope = String(form.get('scope') || '')

  const client = await loadClient(clientId)
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return badRequest('Unknown client or unregistered redirect_uri.')
  }

  const redirectTarget = new URL(redirectUri)
  if (state) redirectTarget.searchParams.set('state', state)

  if (action !== 'allow') {
    redirectTarget.searchParams.set('error', 'access_denied')
    // 303: force the client to GET the redirect_uri instead of re-POSTing to it (307 default).
    return NextResponse.redirect(redirectTarget, 303)
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = String((profile as { role?: string } | null)?.role ?? '').trim()
  if (!isManagerOrAdminRole(role)) {
    return NextResponse.json(
      { error: 'access_denied', error_description: 'Only admin/manager accounts can authorize this connector.' },
      { status: 403 },
    )
  }

  const code = generateAuthorizationCode()
  const serviceClient = createServiceRoleClient()
  await storeAuthorizationCode(serviceClient, {
    code,
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
  })

  redirectTarget.searchParams.set('code', code)
  return NextResponse.redirect(redirectTarget, 303)
}
