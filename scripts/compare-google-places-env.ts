/**
 * Compare API key + request shape: .env.local file vs process.env (as Next/tsx see it).
 * Run: npx tsx scripts/compare-google-places-env.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'

const STANDALONE_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.location,places.primaryType,places.googleMapsUri'

const PROVIDER_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.location',
  'places.primaryType',
  'places.googleMapsUri',
  'nextPageToken',
].join(',')

function maskKey(key: string): string {
  if (key.length <= 12) return '[too-short]'
  return `${key.slice(0, 6)}…${key.slice(-6)} (len=${key.length})`
}

function loadKeyFromEnvFile(): string {
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
    return value
  }
  throw new Error('GOOGLE_MAPS_API_KEY not in .env.local')
}

async function postSearchText(apiKey: string, fieldMask: string, body: object, label: string) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': fieldMask,
  }
  const res = await fetch(SEARCH_TEXT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { label, status: res.status, headers, body, responsePreview: text.slice(0, 120) }
}

async function main() {
  const fileKey = loadKeyFromEnvFile()
  const processKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? ''
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''

  console.log('=== 1. API key sources (masked) ===')
  console.log('  .env.local file parse:     ', maskKey(fileKey))
  console.log('  process.env.GOOGLE_MAPS:   ', processKey ? maskKey(processKey) : '(unset)')
  console.log('  process.env.NEXT_PUBLIC:   ', publicKey ? maskKey(publicKey) : '(unset)')
  console.log('  file === process.env:      ', fileKey === processKey)
  console.log('  file === NEXT_PUBLIC:      ', fileKey === publicKey)
  if (processKey && fileKey !== processKey) {
    console.log('  FIRST DIFF INDEX (file vs process):', firstDiffIndex(fileKey, processKey))
  }

  console.log('\n=== 2–4. Standalone-style request (file key) ===')
  const standaloneBody = { textQuery: 'warehouse in 3025 Australia' }
  console.log('  URL:', SEARCH_TEXT_URL)
  console.log('  Body:', JSON.stringify(standaloneBody))
  const r1 = await postSearchText(fileKey, STANDALONE_FIELD_MASK, standaloneBody, 'file-key-standalone')
  console.log('  Status:', r1.status)

  console.log('\n=== Provider-style request (process.env key) ===')
  const providerBody = {
    textQuery: 'warehouse in 3025 Australia',
    locationBias: {
      circle: {
        center: { latitude: -37.844, longitude: 144.821 },
        radius: 8000,
      },
    },
  }
  console.log('  URL:', SEARCH_TEXT_URL)
  console.log('  FieldMask includes nextPageToken:', PROVIDER_FIELD_MASK !== STANDALONE_FIELD_MASK)
  console.log('  Body:', JSON.stringify(providerBody))
  const envKeyForProvider = processKey || fileKey
  console.log('  Key used:', processKey ? 'process.env' : 'file (fallback — process unset)')
  const r2 = await postSearchText(envKeyForProvider, PROVIDER_FIELD_MASK, providerBody, 'process-key-provider')
  console.log('  Status:', r2.status)

  if (processKey && processKey !== fileKey) {
    console.log('\n=== process.env key with standalone request ===')
    const r3 = await postSearchText(processKey, STANDALONE_FIELD_MASK, standaloneBody, 'process-key-standalone')
    console.log('  Status:', r3.status)
  }
}

function firstDiffIndex(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i
  }
  return a.length === b.length ? -1 : n
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
