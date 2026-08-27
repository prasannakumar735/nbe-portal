/**
 * Phase 1: local stdio MCP server for the PVC strip curtain calculator.
 *
 * Runs on your own machine only, wired into Claude Desktop via
 * `claude_desktop_config.json` / `.mcp.json`. Read-only — never persists a quote.
 *
 * Required env (or set in `.env.local`):
 * - SUPABASE_URL **or** NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/mcp/pvcCalculatorServer.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { registerPvcCalculatorTools } from '../../lib/mcp/pvcCalculatorTools'
import { registerFreightEstimatorTool } from '../../lib/mcp/freightEstimatorTool'
import { registerSendQuoteSummaryTool } from '../../lib/mcp/sendQuoteSummaryTool'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`[pvc-mcp] Missing required environment variable: ${name}`)
    process.exit(2)
  }
  return value
}

const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl) {
  console.error('[pvc-mcp] Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  process.exit(2)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const server = new McpServer({
  name: 'pvc-strip-calculator',
  version: '0.1.0',
})

registerPvcCalculatorTools(server, supabase)
registerFreightEstimatorTool(server)
registerSendQuoteSummaryTool(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[pvc-mcp] PVC calculator MCP server running on stdio')
}

main().catch(error => {
  console.error('[pvc-mcp] Fatal error:', error)
  process.exit(1)
})
