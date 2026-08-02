import { NextResponse } from 'next/server'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'

/** RFC 8414 authorization server metadata, used by MCP clients (ChatGPT/Claude) to discover our OAuth endpoints. */
export async function GET() {
  const base = publicAppBaseUrl()

  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['pvc_calculator'],
  })
}
