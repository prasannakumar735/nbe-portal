import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { parseFiltersFromSearchParams, parseGroupBy } from '@/lib/reports/parseFilters'
import { filterSummaryLines, rowsToCsv, withCsvUtf8Bom } from '@/lib/reports/exportCsv'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import {
  fetchGpsReport,
  fetchMaintenanceReport,
  fetchQuotesReport,
  fetchTimecardReport,
  resolveReportsFilterLabels,
} from '@/lib/reports/supabase-queries'
import { getGpsPrimaryDisplayLocation } from '@/lib/reports/gpsDisplay'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)
    const type = (sp.type ?? 'timecards').toLowerCase()

    const filterLabels = await resolveReportsFilterLabels(supabase, filters)
    const preamble = filterSummaryLines(filters, filterLabels).join('\r\n') + '\r\n\r\n'

    if (type === 'timecards') {
      const groupBy = parseGroupBy(sp.group)
      const data = await fetchTimecardReport(supabase, filters, groupBy)
      const headers = ['Date', 'Technician', 'Client', 'Location', 'Hours', 'Billable']
      const rows: Array<Array<string | number | boolean>> = []
      data.groups.forEach(g => {
        g.rows.forEach(r => {
          rows.push([
            r.entry_date,
            r.technician_name,
            r.client_name,
            r.location_label,
            r.total_hours,
            r.billable ? 'Yes' : 'No',
          ])
        })
      })
      rows.push(['', '', '', 'Grand total', data.grandTotalHours, ''])
      const body = withCsvUtf8Bom(preamble + rowsToCsv(headers, rows))
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nbe-timecards-${filters.dateFrom}_${filters.dateTo}.csv"`,
        },
      })
    }

    if (type === 'maintenance') {
      const list = await fetchMaintenanceReport(supabase, filters)
      const headers = [
        'Client',
        'Site',
        'Technician',
        'Inspection date',
        'Status',
        'Doors',
        'Checklist summary',
        'Notes preview',
        'Attachments',
      ]
      const rows = list.map(r => [
        r.client_name,
        r.site_location,
        r.technician_name,
        r.inspection_date,
        r.status,
        r.total_doors,
        r.checklist_summary,
        r.issues_preview,
        r.attachment_count,
      ])
      const body = withCsvUtf8Bom(preamble + rowsToCsv(headers, rows))
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nbe-maintenance-${filters.dateFrom}_${filters.dateTo}.csv"`,
        },
      })
    }

    if (type === 'gps') {
      const includeCoords = sp.coords === '1' || sp.coords === 'true'
      const list = await fetchGpsReport(supabase, filters, includeCoords)
      const headers = includeCoords
        ? ['Date', 'Technician', 'Location', 'Start coords', 'End coords']
        : ['Date', 'Technician', 'Location']
      const rows = list.map(r =>
        includeCoords
          ? [
              r.entry_date,
              r.technician_name,
              getGpsPrimaryDisplayLocation(r),
              r.start_coords ?? '',
              r.end_coords ?? '',
            ]
          : [r.entry_date, r.technician_name, getGpsPrimaryDisplayLocation(r)]
      )
      const body = preamble + rowsToCsv(headers, rows)
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nbe-gps-${filters.dateFrom}_${filters.dateTo}.csv"`,
        },
      })
    }

    if (type === 'quotes') {
      const { summary, trends } = await fetchQuotesReport(supabase, filters)
      const srows = [
        ['Service quotes count', summary.serviceQuotesCount],
        ['Service quotes total', summary.serviceQuotesTotal],
        ['PVC quotes count', summary.pvcQuotesCount],
        ['PVC quotes total', summary.pvcQuotesTotal],
        ['Note', summary.pipelineNote],
      ]
      const thead = ['Metric', 'Value']
      const tlines = rowsToCsv(thead, srows as Array<Array<string | number | boolean>>)
      const trendHead = ['Week starting', 'Service total', 'PVC total']
      const trendRows = trends.map(t => [t.period, t.service_total, t.pvc_total])
      const body = withCsvUtf8Bom(
        preamble +
          tlines +
          '\r\n\r\n' +
          rowsToCsv(trendHead, trendRows as Array<Array<string | number | boolean>>)
      )
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nbe-quotes-${filters.dateFrom}_${filters.dateTo}.csv"`,
        },
      })
    }

    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
  } catch (e) {
    console.error('[GET /api/manager/reports/export/csv]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'Export failed' }, { status: 500 })
  }
}
