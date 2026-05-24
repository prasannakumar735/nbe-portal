import type { RapidDoorQuoteFormValues, ServiceLineItem } from '@/components/quotes/types'

export const RAPID_DOOR_INTRO_DEFAULT =
  'This quotation is based on the NBE Standard Door comprising a galvanized frame, PVC curtain (900 g/m²), and a zinc-coated control box (RAL 7035). Optional extras (e.g. powder coating, light curtain, remote control, radar, traffic light, induction loop, contactless exit button) are available at additional cost. All other matters shall be subject to our standard Terms and Conditions (T&C). The electrical scope is limited to the connection between the control panel and the doors only. Power supply and isolator shall be provided by others.'

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Preset schedule rows aligned with the Industrial Rapid Door PDF template. */
export function defaultRapidDoorLineItems(): ServiceLineItem[] {
  return [
    {
      itemTitle: 'Industrial Door Rapid Roller Door (Standard Profile)',
      description: 'Width × Height Clear:\nExternal:',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Door Frame',
      description: 'Galvanized',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Curtain',
      description: 'PVC 900g — Blue',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Safety Edge',
      description: 'Soft — Yellow',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Drive System',
      description: 'VF Drive: 1 — 240V up to 2.5 m/s',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Safety Features',
      description: 'Dual Photo Cells BACK 2 (incl.)\nHazard Lamp 1 (incl.)',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Detection',
      description:
        'a: Push Button 1 (incl.)\nb: Radar (1 set) — (excl.)\nc: Remote Control — (excl.)\nd: Induction Loop — (excl.)\ne: Contactless Exit Button — (excl.)',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Installation',
      description: '',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: 'Demolition',
      description: '',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
    {
      itemTitle: '',
      description: '',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
  ]
}

export function emptyRapidDoorFormValues(): RapidDoorQuoteFormValues {
  const serviceDate = new Date().toISOString().split('T')[0]
  const validUntil = addDaysIso(serviceDate, 30)
  return {
    quoteNumber: '',
    serviceDate,
    quoteType: 'new_installation',
    quoteSubCategory: 'rapid_door',
    validUntil,
    salesperson: 'Andrew Newton',
    paymentTerms: '',
    discountPercent: 0,
    hidePricing: false,
    companyName: 'NBE Australia Pty Ltd',
    abn: '17 007 048 008',
    companyAddress: '22a Humeside Drive, Campbellfield Victoria 3061 Australia',
    companyEmail: 'accountsreceivable@nbeaustralia.com.au',
    customerCompany: '',
    attn: '',
    contactPerson: '',
    phone: '',
    customerEmail: '',
    siteAddress: '',
    items: defaultRapidDoorLineItems(),
    notes: '',
    printedName: '',
    signatureDate: serviceDate,
    salesContactName: 'Andrew Newton',
    salesContactPhone: '(04) 2705 5556',
    salesContactEmail: 'anewton@nbeaustralia.com.au',
    scheduleANotes: '',
    quoteSubtitle: 'INDUSTRIAL RAPID DOOR',
    introNote: RAPID_DOOR_INTRO_DEFAULT,
  }
}
