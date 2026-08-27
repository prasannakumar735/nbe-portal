import nodemailer from 'nodemailer'

export interface McpQuoteSummaryEmailInput {
  recipientEmail: string
  openingWidth: number
  openingHeight: number
  stripType: string
  stripWidth: number
  stripThicknessMm: number
  headrailType: string
  doorType: string
  installationType: string
  stripCount: number
  hangerCount: number
  stripLengthMm: number
  billableStripMeters: number
  retailBeforeInstallation: number
  installationCost: number
  finalPrice: number
  freightEstimate?: number | null
  generatedBy?: string
}

function currency(v: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v)
}

function label(key: string): string {
  const map: Record<string, string> = {
    standard: 'Standard (Coolroom smooth)',
    ribbed: 'Ribbed (Coolroom ribbed)',
    polar: 'Polar (Freezer smooth)',
    ribbed_polar: 'Ribbed Polar (Freezer ribbed)',
    colour: 'Colour',
    stainless: 'Stainless Steel',
    galvanized: 'Galvanised',
    aluminium: 'Aluminium',
    plastic: 'Plastic',
    whole_door: 'Whole Door (strips + headrail)',
    strips_only: 'Strips Only',
    supply_only: 'Supply Only',
    supply_install: 'Supply & Install',
  }
  return map[key] ?? key
}

export async function sendMcpQuoteSummaryEmail(input: McpQuoteSummaryEmailInput): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in environment.')
  }

  if (!input.recipientEmail.toLowerCase().endsWith('@nbeaustralia.com.au')) {
    throw new Error('Recipient must be an @nbeaustralia.com.au address.')
  }

  const lines = [
    'PVC Strip Curtain Quote Summary',
    '================================',
    '',
    `Opening:          ${input.openingWidth} mm W × ${input.openingHeight} mm H`,
    `Strip type:       ${label(input.stripType)}`,
    `Strip size:       ${input.stripWidth} mm × ${input.stripThicknessMm} mm`,
    `Headrail:         ${label(input.headrailType)}`,
    `Door type:        ${label(input.doorType)}`,
    `Installation:     ${label(input.installationType)}`,
    '',
    'Quantities',
    '----------',
    `Strip count:      ${input.stripCount}`,
    `Hanger count:     ${input.hangerCount}`,
    `Strip length:     ${input.stripLengthMm} mm each`,
    `Billable material:${input.billableStripMeters.toFixed(2)} m`,
    '',
    'Pricing (ex GST)',
    '----------------',
    `Supply price:     ${currency(input.retailBeforeInstallation)}`,
    ...(input.installationCost > 0 ? [`Installation:     ${currency(input.installationCost)}`] : []),
    ...(input.freightEstimate ? [`Freight (est.):   ${currency(input.freightEstimate)}`] : []),
    `TOTAL:            ${currency(input.finalPrice)}`,
    '',
    '* This is an internal review copy. Please verify before sending to the customer.',
    ...(input.generatedBy ? [`* Generated via ChatGPT MCP by ${input.generatedBy}`] : []),
  ]

  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })

  await transporter.sendMail({
    from,
    to: input.recipientEmail,
    subject: `[Review] PVC Quote — ${input.openingWidth}W × ${input.openingHeight}H, ${input.stripWidth}mm ${label(input.stripType)}`,
    text: lines.join('\n'),
  })
}
