import { NextResponse } from 'next/server'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'

/** RFC 9728 protected resource metadata for /api/mcp — points MCP clients at our authorization server. */
export async function GET() {
  const base = publicAppBaseUrl()

  return NextResponse.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: ['pvc_calculator'],
    bearer_methods_supported: ['header'],
  })
}
