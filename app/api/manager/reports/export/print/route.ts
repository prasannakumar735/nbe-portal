import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { parseFiltersFromSearchParams, parseGroupBy } from '@/lib/reports/parseFilters'
import { filterSummaryRows } from '@/lib/reports/exportCsv'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import {
  fetchGpsReport,
  fetchMaintenanceReport,
  fetchQuotesReport,
  fetchReportsSummary,
  fetchTimecardReport,
  resolveReportsFilterLabels,
} from '@/lib/reports/supabase-queries'
import { getGpsPrimaryDisplayLocation } from '@/lib/reports/gpsDisplay'

export const runtime = 'nodejs'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET(request: NextRequest) {
  try {
    const cspNonce = request.headers.get('x-nonce')?.trim() ?? ''

    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase, request)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)
    const tab = (sp.tab ?? 'timecards').toLowerCase()

    const filterLabels = await resolveReportsFilterLabels(supabase, filters)
    const filterBlock = filterSummaryRows(filters, filterLabels)
      .map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`)
      .join('')

    let bodyInner = ''

    if (tab === 'summary' || tab === 'dashboard') {
      const summary = await fetchReportsSummary(supabase, filters)
      bodyInner = `
        <h2>Summary</h2>
        <table class="meta">
          <tr><td>Total hours</td><td>${esc(String(summary.totalHours))}</td></tr>
          <tr><td>Billable hours</td><td>${esc(String(summary.billableHours))}</td></tr>
          <tr><td>Billable %</td><td>${esc(String(summary.billablePercent))}</td></tr>
          <tr><td>Non-billable hours</td><td>${esc(String(summary.nonBillableHours))}</td></tr>
          <tr><td>Jobs completed</td><td>${esc(String(summary.jobsCompleted))}</td></tr>
          <tr><td>Revenue (quotes)</td><td>${esc(String(summary.revenueTotal))}</td></tr>
          <tr><td>Active technicians</td><td>${esc(String(summary.activeTechnicians))}</td></tr>
        </table>`
    } else if (tab === 'timecards') {
      const groupBy = parseGroupBy(sp.group)
      const data = await fetchTimecardReport(supabase, filters, groupBy)
      const sections = data.groups
        .map(
          g => `
        <h3>${esc(g.label)} — ${esc(String(g.subtotalHours))} h</h3>
        <table>
          <thead><tr>
            <th>Date</th><th>Technician</th><th>Client</th><th>Location</th><th>Work type</th><th>Task</th>
            <th>Start</th><th>End</th><th>Break</th><th>Hours</th><th>Billable</th>
          </tr></thead>
          <tbody>
          ${g.rows
            .map(
              r => `<tr>
            <td>${esc(r.entry_date)}</td>
            <td>${esc(r.technician_name)}</td>
            <td>${esc(r.client_name)}</td>
            <td>${esc(r.location_label)}</td>
            <td>${esc(r.work_type)}</td>
            <td>${esc(r.task)}</td>
            <td>${esc(r.start_time)}</td>
            <td>${esc(r.end_time)}</td>
            <td>${esc(String(r.break_minutes))}</td>
            <td>${esc(String(r.total_hours))}</td>
            <td>${r.billable ? 'Yes' : 'No'}</td>
          </tr>`
            )
            .join('')}
          </tbody>
        </table>`
        )
        .join('')
      bodyInner = `<h2>Timecards (${esc(groupBy)})</h2><p><strong>Grand total:</strong> ${esc(String(data.grandTotalHours))} h</p>${sections}`
    } else if (tab === 'maintenance') {
      const rows = await fetchMaintenanceReport(supabase, filters)
      bodyInner = `
        <h2>Maintenance reports</h2>
        <table>
          <thead><tr>
            <th>Client</th><th>Site</th><th>Technician</th><th>Date</th><th>Status</th><th>Doors</th><th>Checklist</th><th>Notes</th><th>Photos</th>
          </tr></thead>
          <tbody>
          ${rows
            .map(
              r => `<tr>
            <td>${esc(r.client_name)}</td>
            <td>${esc(r.site_location)}</td>
            <td>${esc(r.technician_name)}</td>
            <td>${esc(r.inspection_date)}</td>
            <td>${esc(r.status)}</td>
            <td>${esc(String(r.total_doors))}</td>
            <td>${esc(r.checklist_summary)}</td>
            <td>${esc(r.issues_preview)}</td>
            <td>${esc(String(r.attachment_count))}</td>
          </tr>`
            )
            .join('')}
          </tbody>
        </table>`
    } else if (tab === 'gps') {
      const includeCoords = sp.coords === '1' || sp.coords === 'true'
      const rows = await fetchGpsReport(supabase, filters, includeCoords)
      bodyInner = `
        <h2>GPS activity</h2>
        <table>
          <thead><tr>
            <th>Date</th><th>Technician</th><th>Location</th>
            ${includeCoords ? '<th>Start coords</th><th>End coords</th>' : ''}
          </tr></thead>
          <tbody>
          ${rows
            .map(
              r => `<tr>
            <td>${esc(r.entry_date)}</td>
            <td>${esc(r.technician_name)}</td>
            <td>${esc(getGpsPrimaryDisplayLocation(r))}</td>
            ${
              includeCoords
                ? `<td>${esc(r.start_coords ?? '')}</td><td>${esc(r.end_coords ?? '')}</td>`
                : ''
            }
          </tr>`
            )
            .join('')}
          </tbody>
        </table>`
    } else {
      const { summary, trends } = await fetchQuotesReport(supabase, filters)
      bodyInner = `
        <h2>Quotes &amp; revenue</h2>
        <table class="meta">
          <tr><td>Service quotes</td><td>${summary.serviceQuotesCount} (${esc(String(summary.serviceQuotesTotal))})</td></tr>
          <tr><td>PVC estimates</td><td>${summary.pvcQuotesCount} (${esc(String(summary.pvcQuotesTotal))})</td></tr>
        </table>
        <p>${esc(summary.pipelineNote)}</p>
        <h3>Weekly trend</h3>
        <table>
          <thead><tr><th>Week</th><th>Service</th><th>PVC</th></tr></thead>
          <tbody>
          ${trends
            .map(
              t => `<tr><td>${esc(t.period)}</td><td>${esc(String(t.service_total))}</td><td>${esc(String(t.pvc_total))}</td></tr>`
            )
            .join('')}
          </tbody>
        </table>`
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>NBE Reports — Print</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap" rel="stylesheet" />
  <style${cspNonce ? ` nonce="${esc(cspNonce)}"` : ''}>
    body { font-family: 'Roboto', sans-serif; color: #0f172a; margin: 24px; background: #fff; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .brand img { height: 40px; width: auto; }
    h1 { font-size: 20px; margin: 0 0 4px; font-weight: 650; letter-spacing: -0.02em; }
    .sub { font-size: 12px; color: #64748b; margin: 0 0 20px; }
    h2 { font-size: 16px; margin: 0 0 10px; font-weight: 600; }
    h3 { font-size: 14px; margin: 18px 0 8px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 14px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .meta td:first-child { width: 38%; color: #64748b; }
    @media print {
      body { margin: 12mm; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="brand">
    <img src="/nbe-logo.png" alt="NBE" />
    <div>
      <h1>Reports &amp; Analytics</h1>
      <p class="sub">Operational export — filters apply to all sections below.</p>
    </div>
  </div>
  <h2>Filters</h2>
  <table class="meta">${filterBlock}</table>
  ${bodyInner}
  <script${cspNonce ? ` nonce="${esc(cspNonce)}"` : ''}>window.onload = () => { window.focus(); }</script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (e) {
    console.error('[GET /api/manager/reports/export/print]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'Print export failed' }, { status: 500 })
  }
}
