import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { sendMcpQuoteSummaryEmail } from '@/lib/email/sendMcpQuoteSummaryEmail'
import type { PVCCalculationResponse } from '@/lib/types/pvc.types'

export function registerSendQuoteSummaryTool(server: McpServer) {
  server.registerTool(
    'send_quote_summary_email',
    {
      title: 'Email PVC quote PDF for internal review',
      description:
        'Generates an identical PDF to the NBE portal quote and emails it to an NBE staff address for ' +
        'internal review before sharing with the customer. Only @nbeaustralia.com.au addresses are accepted. ' +
        'Call this AFTER calculate_pvc_quote — pass the breakdown fields from that result plus the full ' +
        'calculationResult object. Before calling, ask the user: ' +
        '"Would you like to email this quote as a PDF for review? " ' +
        '"If yes, enter the recipient @nbeaustralia.com.au address and optionally the customer name and address for the PDF." ' +
        'Do NOT call unless the user explicitly requests the email.',
      inputSchema: {
        recipientEmail: z.string().email(),
        customerName: z.string().optional(),
        customerAttn: z.string().optional(),
        customerAddress: z.string().optional(),
        refNo: z.string().optional(),
        openingWidth: z.number().positive(),
        openingHeight: z.number().positive(),
        stripType: z.enum(['standard', 'ribbed', 'colour', 'polar', 'ribbed_polar']),
        stripWidth: z.number().positive(),
        stripThicknessMm: z.number().positive(),
        overlapMm: z.number().nonnegative(),
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
        calculationResult: z.any(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const data = input as Parameters<typeof sendMcpQuoteSummaryEmail>[0] & { calculationResult: PVCCalculationResponse }

      if (!data.recipientEmail.toLowerCase().endsWith('@nbeaustralia.com.au')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Only @nbeaustralia.com.au email addresses are accepted.' }),
          }],
        }
      }

      await sendMcpQuoteSummaryEmail(data)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Quote PDF sent to ${data.recipientEmail} for internal review.`,
          }),
        }],
      }
    },
  )
}
