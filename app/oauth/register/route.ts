import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { generateOpaqueToken, hashToken } from '@/lib/oauth/tokens'

/** RFC 7591 Dynamic Client Registration — ChatGPT/Claude call this once per connector setup. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Malformed JSON body.' }, { status: 400 })
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((uri): uri is string => typeof uri === 'string' && uri.length > 0)
    : []

  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'redirect_uris is required.' },
      { status: 400 },
    )
  }

  for (const uri of redirectUris) {
    try {
      const parsed = new URL(uri)
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
        return NextResponse.json(
          { error: 'invalid_redirect_uri', error_description: 'redirect_uris must be HTTPS.' },
          { status: 400 },
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'invalid_redirect_uri', error_description: `Invalid redirect_uri: ${uri}` },
        { status: 400 },
      )
    }
  }

  const clientName = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim() : 'MCP client'
  const authMethod = body.token_endpoint_auth_method === 'client_secret_post' ? 'client_secret_post' : 'none'

  const clientId = randomUUID()
  let clientSecret: string | undefined

  const supabase = createServiceRoleClient()
  const insertPayload: Record<string, unknown> = {
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: authMethod,
  }

  if (authMethod === 'client_secret_post') {
    clientSecret = generateOpaqueToken('nbe_oauth_cs')
    insertPayload.client_secret_hash = hashToken(clientSecret)
  }

  const { error } = await supabase.from('oauth_clients').insert(insertPayload)
  if (error) {
    return NextResponse.json({ error: 'server_error', error_description: error.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: authMethod,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201 },
  )
}
