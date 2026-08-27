import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const NBE_ORIGIN = [144.955, -37.670] // Campbellfield 3061 [lng, lat]
const PVC_DENSITY_G_CM3 = 1.4
const MAX_STRIPS_PER_BOX = 16
const MAX_KG_PER_BOX = 20
const MHP_CHARGE = 18.15   // Manual handling — charged when >1 box or any box >20kg
const OSI_CHARGE = 40.70   // Oversize item — charged when headrail >2000mm

// Road Express rates per box (inc. fuel levy), derived from myTNT quotes Aug 2026
const ZONE_RATE: Record<string, number> = {
  VIC_METRO: 26.05,
  VIC_REGIONAL: 29.0,
  NSW_ACT: 30.0,
  QLD: 38.0,
  SA: 38.0,
  TAS: 45.0,
  WA: 55.0,
  NT: 55.0,
}

function getZone(postcode: string, state: string): string {
  const s = state.toUpperCase().trim()
  const pc = parseInt(postcode, 10)

  if (s === 'VIC') {
    // Metro Melbourne postcode ranges
    if ((pc >= 3000 && pc <= 3207) || (pc >= 8000 && pc <= 8999)) return 'VIC_METRO'
    return 'VIC_REGIONAL'
  }
  if (s === 'NSW' || s === 'ACT') return 'NSW_ACT'
  if (s === 'QLD') return 'QLD'
  if (s === 'SA') return 'SA'
  if (s === 'TAS') return 'TAS'
  if (s === 'WA') return 'WA'
  if (s === 'NT') return 'NT'
  return 'VIC_REGIONAL' // fallback
}

function stripWeightKg(stripWidthMm: number, stripThicknessMm: number, stripLengthMm: number): number {
  // PVC density = 1.4 g/cm³; dimensions in mm → cm
  const w = stripWidthMm / 10
  const t = stripThicknessMm / 10
  const l = stripLengthMm / 10
  return (PVC_DENSITY_G_CM3 * w * t * l) / 1000
}

async function getDistanceKm(deliveryAddress: string): Promise<number | null> {
  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) return null

  try {
    // Geocode the delivery address
    const geoRes = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(deliveryAddress + ', Australia')}&boundary.country=AU&size=1`,
    )
    if (!geoRes.ok) return null
    const geoData = await geoRes.json()
    const coords = geoData?.features?.[0]?.geometry?.coordinates
    if (!coords) return null

    // Distance matrix from Campbellfield to delivery
    const matrixRes = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [NBE_ORIGIN, coords],
        sources: [0],
        destinations: [1],
        metrics: ['distance'],
      }),
    })
    if (!matrixRes.ok) return null
    const matrixData = await matrixRes.json()
    const distanceM = matrixData?.distances?.[0]?.[0]
    if (typeof distanceM !== 'number') return null
    return Math.round(distanceM / 1000)
  } catch {
    return null
  }
}

export function registerFreightEstimatorTool(server: McpServer) {
  server.registerTool(
    'estimate_freight',
    {
      title: 'Estimate TNT freight cost',
      description:
        'Estimates TNT Road Express freight cost for an NBE PVC strip curtain order. ' +
        'Call this AFTER calculate_pvc_quote — use the strip count, strip dimensions, and headrail length ' +
        'from that result. Ask the user for their delivery suburb, state, and postcode before calling. ' +
        'This is an estimate only — actual TNT invoice may vary. Read-only.',
      inputSchema: {
        deliverySuburb: z.string(),
        deliveryState: z.enum(['VIC', 'NSW', 'ACT', 'QLD', 'SA', 'WA', 'TAS', 'NT']),
        deliveryPostcode: z.string().regex(/^\d{4}$/),
        installationType: z.enum(['supply_only', 'supply_install']),
        stripCount: z.number().int().positive(),
        stripWidthMm: z.number().positive(),
        stripThicknessMm: z.number().positive(),
        stripLengthMm: z.number().positive(),
        headrailLengthMm: z.number().nonnegative(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const {
        deliverySuburb, deliveryState, deliveryPostcode, installationType,
        stripCount, stripWidthMm, stripThicknessMm, stripLengthMm, headrailLengthMm,
      } = input as {
        deliverySuburb: string; deliveryState: string; deliveryPostcode: string
        installationType: string
        stripCount: number; stripWidthMm: number; stripThicknessMm: number
        stripLengthMm: number; headrailLengthMm: number
      }

      // Box calculation
      const kgPerStrip = stripWeightKg(stripWidthMm, stripThicknessMm, stripLengthMm)
      const stripsPerBox = Math.min(MAX_STRIPS_PER_BOX, Math.floor(MAX_KG_PER_BOX / kgPerStrip))
      const boxCount = Math.ceil(stripCount / stripsPerBox)
      const heaviestBoxKg = Math.min(stripsPerBox, stripCount) * kgPerStrip

      // Freight base
      const zone = getZone(deliveryPostcode, deliveryState)
      const ratePerBox = ZONE_RATE[zone] ?? ZONE_RATE['VIC_REGIONAL']
      const baseFreight = Math.round(boxCount * ratePerBox * 100) / 100

      // Surcharges
      const mhpApplies = boxCount > 1 || heaviestBoxKg > MAX_KG_PER_BOX
      // OSI triggered by strip packaging tube length (strips can't be cut).
      // Headrail is always cut to ≤2000mm pieces by NBE — does not trigger OSI.
      const osiApplies = stripLengthMm > 2000
      const mhpCost = mhpApplies ? MHP_CHARGE : 0
      const osiCost = osiApplies ? OSI_CHARGE : 0
      const totalEstimate = Math.round((baseFreight + mhpCost + osiCost) * 100) / 100

      // Show driving distance only for supply+install so installer can plan the journey
      let drivingDistanceKm: number | null = null
      if (installationType === 'supply_install') {
        const address = `${deliverySuburb} ${deliveryPostcode} ${deliveryState}`
        drivingDistanceKm = await getDistanceKm(address)
      }

      const result: Record<string, unknown> = {
        destination: `${deliverySuburb}, ${deliveryState} ${deliveryPostcode}`,
        ...(installationType === 'supply_install' && {
          drivingDistanceFromWarehouse: drivingDistanceKm ? `${drivingDistanceKm} km` : 'unavailable',
        }),
        boxes: {
          count: boxCount,
          stripsPerBox,
          heaviestBoxKg: Math.round(heaviestBoxKg * 100) / 100,
        },
        freight: {
          zone,
          ratePerBox,
          baseFreight,
          mhpSurcharge: mhpApplies ? MHP_CHARGE : 0,
          mhpReason: mhpApplies ? (boxCount > 1 ? `${boxCount} boxes` : `box weight ${Math.round(heaviestBoxKg * 10) / 10}kg > 20kg`) : null,
          osiSurcharge: osiApplies ? OSI_CHARGE : 0,
          osiReason: osiApplies ? `strip packaging tube ${Math.round(stripLengthMm)}mm > 2000mm` : null,
          totalEstimate,
        },
        note: 'Estimate only — actual TNT invoice may include additional surcharges. Fuel levy included in base rate.',
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )
}
