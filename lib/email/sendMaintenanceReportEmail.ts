import { sendMailViaGraph } from '@/lib/graph/sendMail'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'

export async function sendMaintenanceReportEmail(
  report: MaintenanceFormValues,
  pdfBuffer: Uint8Array,
  fileName: string,
): Promise<void> {
  const to = process.env.MAINTENANCE_ADMIN_EMAIL || 'service@nbeaustralia.com.au'

  await sendMailViaGraph({
    to,
    subject: `Maintenance Report Submitted - ${report.inspection_date}`,
    bodyText: [
      'A maintenance inspection report has been submitted.',
      `Technician: ${report.technician_name}`,
      `Inspection Date: ${report.inspection_date}`,
      `Doors Inspected: ${report.total_doors}`,
    ].join('\n'),
    attachments: [
      {
        name: fileName,
        contentType: 'application/pdf',
        contentBytes: Buffer.from(pdfBuffer).toString('base64'),
      },
    ],
  })
}
