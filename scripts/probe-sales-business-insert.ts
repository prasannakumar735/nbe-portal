import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnv(name: string): string {
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    if (t.slice(0, i).trim() !== name) continue
    return t.slice(i + 1).trim()
  }
  throw new Error(`Missing ${name}`)
}

async function main() {
  const url = loadEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = loadEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, key)

  const { data: scanRun, error: scanErr } = await supabase
    .from('sales_scan_runs')
    .insert({
      postcode: '3025',
      status: 'running',
      started_at: new Date().toISOString(),
      created_by: '577fb1a7-ecbe-4326-bea2-99f0baaed9a3',
    })
    .select('*')
    .single()

  if (scanErr) {
    console.error('scan_run insert error:', JSON.stringify(scanErr, null, 2))
    process.exit(1)
  }

  const payload = [
    {
      scan_run_id: scanRun.id,
      company_name: 'One Warehousing and Distribution',
      address: '209 Maidstone St',
      suburb: 'Altona',
      postcode: '3025',
      website: 'http://www.onewarehousing.com.au/',
      phone: '1300 884 504',
      category: 'warehouse',
      source: 'google_maps',
      status: 'new',
      selected: false,
      contact_attempts: 0,
      scanned_at: new Date().toISOString(),
      raw_payload: {
        provider: 'google_places',
        place_id: 'ChIJY_V1DN5j1moR3xJzxb8JVo8',
      },
    },
  ]

  console.log('Table: sales_businesses')
  console.log('Insert payload:', JSON.stringify(payload, null, 2))

  const { data, error } = await supabase.from('sales_businesses').insert(payload).select('*')

  if (error) {
    console.error('Full Supabase error object:', error)
    console.error('Error JSON:', JSON.stringify(error, null, 2))
    process.exit(1)
  }

  console.log('Insert OK, rows:', data?.length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
