import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { sendMcpQuoteSummaryEmail } from '@/lib/email/sendMcpQuoteSummaryEmail'

export function registerSendQuoteSummaryTool(server: McpServer) {
  server.registerTool(
    'send_quote_summary_email',
    {
      title: 'Email PVC quote summary for internal review',
      description:
        'Sends a plain-text PVC strip curtain quote summary to an NBE staff email address for internal ' +
        'review before sharing with the customer. Only @nbeaustralia.com.au addresses are accepted. ' +
        'Call this AFTER calculate_pvc_quote — pass the key fields from that result. ' +
        'Ask the user: "Would you like to email this quote for review? Enter an @nbeaustralia.com.au address." ' +
        'Do NOT call this tool unless the user explicitly requests the email.',
      inputSchema: {
        recipientEmail: z.string().email(),
        openingWidth: z.number().positive(),
        openingHeight: z.number().positive(),
        stripType: z.enum(['standard', 'ribbed', 'colour', 'polar', 'ribbed_polar']),
        stripWidth: z.number().positive(),
        stripThicknessMm: z.number().positive(),
        headrailType: z.enum(['stainless', 'galvanized', 'aluminium', 'plastic']),
        doorType: z.enum(['whole_door', 'strips_only']),
        installationType: z.enum(['supply_only', 'supply_install']),
        stripCount: z.number().int().positive(),
        hangerCount: z.number().int().nonnegative(),
        stripLengthMm: z.number().positive(),
        billableStripMeters: z.number().positive(),
        retailBeforeInstallation: z.number().nonnegative(),
        installationCost: z.number().nonnegative().optional(),
        finalPrice: z.number().nonnegative(),
        freightEstimate: z.number().nonnegative().optional(),
        generatedBy: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const data = input as Parameters<typeof sendMcpQuoteSummaryEmail>[0]

      if (!data.recipientEmail.toLowerCase().endsWith('@nbeaustralia.com.au')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Only @nbeaustralia.com.au email addresses are accepted for internal review.' }),
          }],
        }
      }

      await sendMcpQuoteSummaryEmail(data)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Quote summary sent to ${data.recipientEmail} for internal review.`,
          }),
        }],
      }
    },
  )
}
