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
  stripsPerHanger: z.union([z.literal(1), z.literal(2)]).optional(),
  stripThicknessMm: z.number().positive(),
  overlapMm: z.number().nonnegative().optional(),
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
        'Before calling, ask the user for whichever of these are not already given: openingWidthMm, ' +
        'openingHeightMm, stripType, stripWidth, hangerWidthMm, stripThicknessMm, headrailType (galvanized, ' +
        'stainless, aluminium, or plastic), and installationType. Do NOT ask about overlapMm or stripsPerHanger — ' +
        'omit them entirely and this tool applies NBE\'s standard defaults automatically (same rule the NBE ' +
        'portal calculator itself uses): overlapMm defaults to 15mm when stripWidth is 100mm, otherwise 50mm; ' +
        'stripsPerHanger defaults to 2 only when stripWidth is 100mm and hangerWidthMm is 150mm, otherwise 1. ' +
        'Only pass overlapMm/stripsPerHanger explicitly if the user states a non-standard value themselves. ' +
        'Do not answer without calling this tool. Read-only — does not save a quote.',
      inputSchema: calculateInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async input => {
      const raw = input as PVCCalculatorInput & { overlapMm?: number; stripsPerHanger?: 1 | 2 }

      // Same defaulting rule as the NBE portal calculator UI itself
      // (components/pvc/PVCCalculatorClient.tsx updateField('stripWidth')): overlap and
      // strips-per-hanger vary predictably with stripWidth/hangerWidthMm, so callers
      // shouldn't need to ask the user for them unless they want a non-standard value.
      const overlapMm = raw.overlapMm ?? (raw.stripWidth === 100 ? 15 : 50)
      const stripsPerHanger =
        raw.stripsPerHanger ?? (raw.stripWidth === 100 && raw.hangerWidthMm === 150 ? 2 : 1)

      const calculatorInput: PVCCalculatorInput = { ...raw, overlapMm, stripsPerHanger }
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
