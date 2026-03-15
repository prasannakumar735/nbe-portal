import nodemailer from 'nodemailer'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'

export async function sendMaintenanceReportEmail(
  report: MaintenanceFormValues,
  pdfBuffer: Uint8Array,
  fileName: string,
): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const to = process.env.MAINTENANCE_ADMIN_EMAIL || 'service@nbeaustralia.com.au'

  if (!host || !user || !pass || !from) {
    throw new Error('Missing SMTP configuration for maintenance email.')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to,
    subject: `Maintenance Report Submitted - ${report.inspection_date}`,
    text: [
      'A maintenance inspection report has been submitted.',
      `Technician: ${report.technician_name}`,
      `Inspection Date: ${report.inspection_date}`,
      `Doors Inspected: ${report.total_doors}`,
    ].join('\n'),
    attachments: [
      {
        filename: fileName,
        content: Buffer.from(pdfBuffer),
        contentType: 'application/pdf',
      },
    ],
  })
}
