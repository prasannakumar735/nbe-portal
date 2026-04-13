import { readFileSync } from 'fs'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { registerRobotoForReactPdf } from '@/lib/pdf/reactPdfRoboto'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import { filterSummaryRows } from '@/lib/reports/exportCsv'
import { parseFiltersFromSearchParams, parseTab } from '@/lib/reports/parseFilters'
import {
  ReportsExportPdfDocument,
  type ReportsPdfTab,
  type TimecardPdfRowFull,
} from '@/lib/reports/ReportsExportPdfDocument'
import type { GpsReportRow, MaintenanceReportRow, QuotePvcLine, QuoteServiceLine, QuoteTrendRow, QuotesReportSummary } from '@/lib/reports/types'
import {
  fetchGpsReport,
  fetchMaintenanceReport,
  fetchQuotesReport,
  fetchReportsSummary,
  fetchTimecardReport,
  resolveReportsFilterLabels,
} from '@/lib/reports/supabase-queries'
import { createPdfBinaryResponse } from '@/lib/http/pdfBinaryResponse'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)
    const tab = parseTab(sp.tab) as ReportsPdfTab
    const gpsIncludeCoords = sp.coords === '1' || sp.coords === 'true'

    const summary = await fetchReportsSummary(supabase, filters)
    const filterLabels = await resolveReportsFilterLabels(supabase, filters)
    const filterRows = filterSummaryRows(filters, filterLabels)

    const logoPath = join(process.cwd(), 'public', 'nbe-logo.png')
    const logoBytes = readFileSync(logoPath)
    const logoSrc = `data:image/png;base64,${logoBytes.toString('base64')}`

    const generatedAt = new Date().toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const dateRangeLabel = `${filters.dateFrom} → ${filters.dateTo}`

    let timecardRows: TimecardPdfRowFull[] = []
    let timecardGrandTotal = 0
    let maintenanceRows: MaintenanceReportRow[] = []
    let gpsRows: GpsReportRow[] = []
    let quotesBundle: {
      quoteSummary: QuotesReportSummary
      trends: QuoteTrendRow[]
      serviceLines: QuoteServiceLine[]
      pvcLines: QuotePvcLine[]
    } | null = null

    if (tab === 'timecards') {
      const data = await fetchTimecardReport(supabase, filters, 'day')
      timecardGrandTotal = data.grandTotalHours
      data.groups.forEach(g => {
        g.rows.forEach(r => {
          timecardRows.push({
            date: r.entry_date,
            technician: r.technician_name,
            client: r.client_name,
            location: r.location_label,
            workType: r.work_type,
            task: r.task,
            start: r.start_time,
            end: r.end_time,
            breakMin: String(r.break_minutes),
            hours: String(r.total_hours),
            billable: r.billable ? 'Yes' : 'No',
          })
        })
      })
    } else if (tab === 'maintenance') {
      maintenanceRows = await fetchMaintenanceReport(supabase, filters)
    } else if (tab === 'gps') {
      gpsRows = await fetchGpsReport(supabase, filters, gpsIncludeCoords)
    } else {
      const q = await fetchQuotesReport(supabase, filters)
      quotesBundle = {
        quoteSummary: q.summary,
        trends: q.trends,
        serviceLines: q.serviceLines,
        pvcLines: q.pvcLines,
      }
    }

    let pdfRowCount = 0
    if (tab === 'timecards') pdfRowCount = timecardRows.length
    else if (tab === 'maintenance') pdfRowCount = maintenanceRows.length
    else if (tab === 'gps') pdfRowCount = gpsRows.length
    else if (quotesBundle) {
      pdfRowCount =
        quotesBundle.serviceLines.length + quotesBundle.pvcLines.length + quotesBundle.trends.length
    }
    console.log('[PDF export] tab:', tab, 'PDF rows:', pdfRowCount)

    registerRobotoForReactPdf(request.nextUrl.origin)

    const buffer = await renderToBuffer(
      <ReportsExportPdfDocument
        logoSrc={logoSrc}
        dateRangeLabel={dateRangeLabel}
        filterRows={filterRows}
        summary={summary}
        tab={tab}
        timecardRows={timecardRows}
        timecardGrandTotal={timecardGrandTotal}
        maintenanceRows={maintenanceRows}
        gpsRows={gpsRows}
        gpsIncludeCoords={gpsIncludeCoords}
        quotes={quotesBundle}
        generatedAt={generatedAt}
      />
    )

    return createPdfBinaryResponse(buffer, {
      contentDisposition: `attachment; filename="nbe-reports-${filters.dateFrom}_${filters.dateTo}.pdf"`,
    })
  } catch (e) {
    console.error('[GET /api/manager/reports/export/pdf]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'PDF export failed' }, { status: 500 })
  }
}
