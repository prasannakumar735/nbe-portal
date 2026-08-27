import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerPvcCalculatorTools } from '@/lib/mcp/pvcCalculatorTools'
import { registerFreightEstimatorTool } from '@/lib/mcp/freightEstimatorTool'
import { verifyMcpToken } from '@/lib/services/mcpAuth.service'
import { verifyOAuthAccessToken } from '@/lib/oauth/verifyAccessToken'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'

function unauthorized() {
  const resourceMetadataUrl = `${publicAppBaseUrl()}/.well-known/oauth-protected-resource`
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'www-authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
    },
  })
}

async function handleRequest(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    return unauthorized()
  }

  const supabase = createServiceRoleClient()

  // OAuth-issued access tokens (ChatGPT/Claude connector login) or legacy static
  // per-person tokens (Phase 2 manual setup) — either is accepted.
  const oauthAuth = token.startsWith('nbe_oauth_at_') ? await verifyOAuthAccessToken(supabase, token) : null
  const legacyAuth = !oauthAuth && !token.startsWith('nbe_oauth_at_') ? await verifyMcpToken(supabase, token) : null

  if (!oauthAuth && !legacyAuth) {
    return unauthorized()
  }

  const server = new McpServer({
    name: 'pvc-strip-calculator',
    version: '0.1.0',
  })

  registerPvcCalculatorTools(server, supabase)
  registerFreightEstimatorTool(server)

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  await server.connect(transport)

  return transport.handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request)
}
