type MaintenanceEmailTemplateParams = {
  technicianName: string
  siteName: string
  address: string
  inspectionDate: string
  inspectionStart: string
  inspectionEnd: string
  totalDoors: number
}

export function buildMaintenanceReportEmailTemplate(params: MaintenanceEmailTemplateParams): string {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hi Team,</p>
      <p>A maintenance inspection report has been submitted.</p>
      <p><strong>Technician Name:</strong> ${params.technicianName}</p>
      <p><strong>Site / Client Name:</strong> ${params.siteName}</p>
      <p><strong>Address:</strong> ${params.address}</p>
      <p><strong>Inspection Date:</strong> ${params.inspectionDate}</p>
      <p><strong>Inspection Time:</strong> ${params.inspectionStart} - ${params.inspectionEnd}</p>
      <p><strong>Total Doors Inspected:</strong> ${params.totalDoors}</p>
      <p>Please find the inspection report attached.</p>
      <p>Regards<br/>NBE Portal System</p>
    </div>
  `
}
