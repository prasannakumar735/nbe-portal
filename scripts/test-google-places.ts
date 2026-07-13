/**
 * Minimal Places API (New) SearchText smoke test. No app imports.
 * Run: npx tsx scripts/test-google-places.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.location,places.primaryType,places.googleMapsUri'

function loadGoogleMapsApiKey(): string {
  const envPath = resolve(process.cwd(), '.env.local')
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const name = trimmed.slice(0, eq).trim()
    if (name !== 'GOOGLE_MAPS_API_KEY') continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!value) throw new Error('GOOGLE_MAPS_API_KEY is empty in .env.local')
    return value
  }
  throw new Error('GOOGLE_MAPS_API_KEY not found in .env.local')
}

async function main() {
  const apiKey = loadGoogleMapsApiKey()

  const res = await fetch(SEARCH_TEXT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: 'warehouse in 3025 Australia',
    }),
  })

  const bodyText = await res.text()

  console.log('HTTP status:', res.status)
  console.log('Response body:')
  try {
    console.log(JSON.stringify(JSON.parse(bodyText), null, 2))
  } catch {
    console.log(bodyText)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
