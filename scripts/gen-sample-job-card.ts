import { writeFileSync } from 'node:fs'
import { generatePvcFlexJobCardPdf } from '@/lib/pdf/generatePvcFlexJobCardPdf'

const BASE = {
  jobCardNumber:   'JCPF-261015-001',
  quoteNumber:     'QPVC261001003',
  assignedToName:  'Thomas Newton',
  poReference:     'PO-2026-4421',
  requiredBy:      '22 Oct 2026',
  notes:           'Freezer-grade strips — handle with gloves. Install headrail first before threading strips. Client prefers installation before 7am shift start.',
  createdDate:     '15 Oct 2026',
  customerName:    'Campbellfield Cold Storage Pty Ltd',
  customerAttn:    'John Smith',
  customerAddress: '14 Industrial Drive, Campbellfield VIC 3061',
  scopeOfWork:     'Supply & Install',
}

const DOOR1 = {
  doorLabel:   'Door 1',
  openingW:    3000,
  openingH:    3500,
  stripWidth:  300,
  thickness:   3,
  grade:       'Freezer',
  profile:     'Ribbed',
  hanger:      'Stainless Steel',
  supplyType:  'Complete Door',
  numStrips:   11,
  cutLengthMm: 3650,
  coverageM:   3.0,
  sliding:     'NA',
  qty:         1,
}

const DOOR2 = {
  doorLabel:   'Door 2',
  openingW:    2500,
  openingH:    3200,
  stripWidth:  200,
  thickness:   2,
  grade:       'Ambient',
  profile:     'Flat',
  hanger:      'Galvanised',
  supplyType:  'Strip Curtain Only',
  numStrips:   14,
  cutLengthMm: 3350,
  coverageM:   2.5,
  qty:         2,
}

async function main() {
  const single = await generatePvcFlexJobCardPdf({ ...BASE, doors: [DOOR1] })
  writeFileSync('scripts/JCPF-SINGLE.pdf', Buffer.from(single))
  console.log('✅ Single door: scripts/JCPF-SINGLE.pdf')

  const two = await generatePvcFlexJobCardPdf({ ...BASE, doors: [DOOR1, DOOR2] })
  writeFileSync('scripts/JCPF-TWO.pdf', Buffer.from(two))
  console.log('✅ Two doors:   scripts/JCPF-TWO.pdf')
}

main().catch(e => { console.error(e); process.exit(1) })
