import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { generateQuote } from '@/lib/services/pvcCalculator.service'
import type { PVCCalculatorInput } from '@/lib/types/pvc.types'

const calculateInputSchema = {
  openingWidthMm: z.number().positive(),
  openingHeightMm: z.number().positive(),
  stripType: z.enum(['standard', 'ribbed', 'colour', 'polar', 'ribbed_polar']),
  stripWidth: z.union([z.literal(100), z.literal(150), z.literal(200), z.literal(300)]),
  hangerWidthMm: z.union([
    z.literal(100),
    z.literal(150),
    z.literal(200),
    z.literal(300),
    z.literal(400),
    z.literal(1200),
    z.literal(1370),
  ]),
  stripsPerHanger: z.union([z.literal(1), z.literal(2)]),
  stripThicknessMm: z.number().positive(),
  overlapMm: z.number().nonnegative(),
  headrailType: z.enum(['stainless', 'galvanized', 'aluminium', 'plastic']),
  installationType: z.enum(['supply_only', 'supply_install']),
  doorType: z.enum(['whole_door', 'strips_only']).optional(),
  manualInstallationPrice: z.number().nonnegative().optional(),
  manualFreightPrice: z.number().nonnegative().optional(),
  freightRequired: z.boolean().optional(),
}

export function registerPvcCalculatorTools(server: McpServer, supabase: SupabaseClient) {
  server.registerTool(
    'calculate_pvc_quote',
    {
      title: 'Calculate PVC strip curtain quote',
      description:
        'MANDATORY for any NBE PVC strip curtain quote, price, or calculation request (e.g. "PVC quote for a ' +
        '2000x2400mm opening"). Never estimate, guess, or hand-calculate strip counts, material quantities, ' +
        'weights, or pricing yourself — those numbers do not exist anywhere else and any number you invent ' +
        'will be wrong. This tool queries the real NBE Supabase pricing tables (the same engine the NBE portal ' +
        'calculator uses) and is the ONLY source of truth for strip counts, quantities, and dollar pricing. ' +
        'If openingWidthMm/openingHeightMm are known but other required fields (stripType, stripWidth, ' +
        'hangerWidthMm, stripsPerHanger, stripThicknessMm, overlapMm, headrailType, installationType) are not ' +
        'given by the user, ask the user for them before calling this tool — do not assume defaults and do not ' +
        'answer without calling this tool. Read-only — does not save a quote.',
      inputSchema: calculateInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async input => {
      const calculatorInput = input as PVCCalculatorInput
      const result = await generateQuote(supabase, calculatorInput, { persistQuote: false })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    },
  )
}
