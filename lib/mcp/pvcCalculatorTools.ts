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
  hangerWidthMm: z
    .union([
      z.literal(100),
      z.literal(150),
      z.literal(200),
      z.literal(300),
      z.literal(400),
      z.literal(1200),
      z.literal(1370),
    ])
    .optional(),
  stripsPerHanger: z.union([z.literal(1), z.literal(2)]).optional(),
  stripThicknessMm: z.number().positive(),
  overlapMm: z.number().nonnegative().optional(),
  headrailType: z.enum(['stainless', 'galvanized', 'aluminium', 'plastic']),
  installationType: z.enum(['supply_only', 'supply_install']),
  doorType: z.enum(['whole_door', 'strips_only']),
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
        '2000x2400mm opening", or just "2200h and 2500w"). Never estimate, guess, or hand-calculate strip ' +
        'counts, material quantities, weights, or pricing yourself — those numbers do not exist anywhere else ' +
        'and any number you invent will be wrong. This tool queries the real NBE Supabase pricing tables (the ' +
        'same engine the NBE portal calculator uses) and is the ONLY source of truth for strip counts, ' +
        'quantities, and dollar pricing.\n\n' +
        'CRITICAL: Do NOT call this tool until you have explicit answers to ALL 7 questions below. ' +
        'Answering any question does NOT mean the others can be assumed or skipped — every field is required ' +
        'and has no safe default you can guess. Ask ONE question at a time, wait for the answer, then ask the next:\n' +
        '1. "What type of strip do you need — coolroom or freezer?" (freezer = polar-grade PVC, for the more ' +
        'extreme cold of a freezer; coolroom = standard-grade PVC — NBE staff may call this "Duraflex," which ' +
        'is the same thing as the standard grade, not a separate product). Remember this as the material ' +
        'grade, do not set stripType yet.\n' +
        '2. "What strip width would you like — 100mm, 150mm, 200mm, or 300mm?" → stripWidth.\n' +
        '3. "What thickness?" — offer only the options that actually exist for that stripWidth (do not assume ' +
        '2mm/3mm applies to every width; check what NBE stocks: 100mm strips come in 1.6mm or 2mm, 150mm in ' +
        '2mm or 3mm, 200mm in 2mm/3mm/4mm, 300mm in 2mm/3mm/4mm/5mm) → stripThicknessMm.\n' +
        '4. "Ribbed or standard (smooth) surface?" — combine with the answer from question 1 to set stripType: ' +
        'freezer+smooth="polar", freezer+ribbed="ribbed_polar", coolroom+smooth="standard", coolroom+ribbed=' +
        '"ribbed".\n' +
        '5. "Whole door (strips + headrail) or strips only?" → doorType (whole_door / strips_only).\n' +
        '6. Only ask this if the answer to question 5 was whole_door: "What headrail material — stainless ' +
        'steel, galvanised, or aluminium?" → headrailType (map "galvanised" to "galvanized"). Only offer ' +
        '"plastic" if the user asks for it specifically. If strips_only, default headrailType to "aluminium" ' +
        'internally (it still must be passed to the tool) but do NOT ask the user.\n' +
        '7. "Supply only, or supply and install?" → installationType. If they choose supply and install, also ' +
        'ask "What installation price should I include?" and pass the answer as manualInstallationPrice — do ' +
        'not silently default it to $0.\n\n' +
        'Do NOT ask about hangerWidthMm — omit it entirely; it defaults to the same value as stripWidth ' +
        '(matches the NBE portal calculator\'s own default) unless the user states a different hanger width ' +
        'themselves. Do NOT ask about overlapMm or stripsPerHanger — omit them entirely and this tool applies ' +
        'NBE\'s standard defaults automatically (same rule the NBE portal calculator itself uses): overlapMm ' +
        'defaults to 15mm when stripWidth is 100mm, otherwise 50mm; stripsPerHanger defaults to 2 only when ' +
        'stripWidth is 100mm and hangerWidthMm is 150mm, otherwise 1. Only pass overlapMm/stripsPerHanger/' +
        'hangerWidthMm explicitly if the user states a non-standard value themselves. ' +
        'Do not answer without calling this tool. Read-only — does not save a quote.\n\n' +
        'After showing the quote result, always ask these two follow-up questions (one at a time):\n' +
        'A. "Would you like a freight estimate? If yes, please provide the delivery suburb, state, and postcode." ' +
        '— then call estimate_freight with the strip details from this result.\n' +
        'B. "Would you like to email this quote as a PDF for internal review? If yes, enter the recipient ' +
        '@nbeaustralia.com.au address." — then call send_quote_summary_email.',
      inputSchema: calculateInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async input => {
      const raw = input as PVCCalculatorInput & { overlapMm?: number; stripsPerHanger?: 1 | 2; hangerWidthMm?: number }

      // Same defaulting rule as the NBE portal calculator UI itself
      // (components/pvc/PVCCalculatorClient.tsx updateField('stripWidth')): hanger width
      // matches strip width, overlap/strips-per-hanger vary predictably with
      // stripWidth/hangerWidthMm, so callers shouldn't need to ask the user for these
      // unless they want a non-standard value.
      const hangerWidthMm = (raw.hangerWidthMm ?? raw.stripWidth) as PVCCalculatorInput['hangerWidthMm']
      const overlapMm = raw.overlapMm ?? (raw.stripWidth === 100 ? 15 : 50)
      const stripsPerHanger =
        raw.stripsPerHanger ?? (raw.stripWidth === 100 && hangerWidthMm === 150 ? 2 : 1)

      const calculatorInput: PVCCalculatorInput = { ...raw, hangerWidthMm, overlapMm, stripsPerHanger }
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
