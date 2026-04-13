import type { ReactElement } from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type {
  GpsReportRow,
  MaintenanceReportRow,
  QuotePvcLine,
  QuoteServiceLine,
  QuoteTrendRow,
  QuotesReportSummary,
  ReportsSummary,
} from '@/lib/reports/types'
import { getGpsPrimaryDisplayLocation } from '@/lib/reports/gpsDisplay'

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 36,
    color: '#0f172a',
    fontFamily: 'Roboto',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
  },
  logo: { width: 100, height: 32, objectFit: 'contain' },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 16, fontWeight: 700 },
  subtitle: { fontSize: 8, color: '#64748b', marginTop: 4 },
  continueBar: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6, color: '#334155' },
  filterRow: { flexDirection: 'row', marginBottom: 3, fontSize: 8 },
  filterLabel: { width: 100, color: '#64748b' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  kpi: {
    width: '30%',
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    borderRadius: 4,
  },
  kpiLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase' },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 4 },
  table: { marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  th: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 3,
    minHeight: 16,
  },
  cell: { fontSize: 6, paddingRight: 2 },
  note: { fontSize: 7, color: '#64748b', marginTop: 6, marginBottom: 4 },
  empty: { fontSize: 9, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
})

export type ReportsPdfTab = 'timecards' | 'maintenance' | 'gps' | 'quotes'

export type TimecardPdfRowFull = {
  date: string
  technician: string
  client: string
  location: string
  workType: string
  task: string
  start: string
  end: string
  breakMin: string
  hours: string
  billable: string
}

export type ReportsExportPdfDocumentProps = {
  logoSrc: string
  dateRangeLabel: string
  filterRows: Array<[string, string]>
  summary: ReportsSummary
  tab: ReportsPdfTab
  timecardRows: TimecardPdfRowFull[]
  timecardGrandTotal: number
  maintenanceRows: MaintenanceReportRow[]
  gpsRows: GpsReportRow[]
  gpsIncludeCoords: boolean
  quotes: {
    quoteSummary: QuotesReportSummary
    trends: QuoteTrendRow[]
    serviceLines: QuoteServiceLine[]
    pvcLines: QuotePvcLine[]
  } | null
  generatedAt: string
}

function splitChunks<T>(items: T[], firstPageSize: number, restPageSize: number): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []
  let i = 0
  chunks.push(items.slice(i, i + firstPageSize))
  i += firstPageSize
  while (i < items.length) {
    chunks.push(items.slice(i, i + restPageSize))
    i += restPageSize
  }
  return chunks
}

function PdfFooter({ generatedAt, tab }: { generatedAt: string; tab: ReportsPdfTab }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `Generated ${generatedAt} · NBE Portal · Tab: ${tab} · Page ${pageNumber} of ${totalPages}`
      }
    />
  )
}

function BrandHeader({
  logoSrc,
  dateRangeLabel,
  title,
}: {
  logoSrc: string
  dateRangeLabel: string
  title?: string
}) {
  return (
    <View style={styles.header}>
      <Image src={logoSrc} style={styles.logo} />
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title ?? 'Reports & Analytics'}</Text>
        <Text style={styles.subtitle}>{dateRangeLabel}</Text>
      </View>
    </View>
  )
}

function FiltersBlock({ filterRows }: { filterRows: Array<[string, string]> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Filters</Text>
      {filterRows.map(([k, v], i) => (
        <View key={i} style={styles.filterRow} wrap={false}>
          <Text style={styles.filterLabel}>{k}</Text>
          <Text style={{ flex: 1 }}>{v}</Text>
        </View>
      ))}
    </View>
  )
}

function TotalsBlock({ summary }: { summary: ReportsSummary }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Totals</Text>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Total hours</Text>
          <Text style={styles.kpiValue}>{summary.totalHours.toFixed(2)}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Revenue</Text>
          <Text style={styles.kpiValue}>${summary.revenueTotal.toLocaleString()}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Billable %</Text>
          <Text style={styles.kpiValue}>{summary.billablePercent.toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  )
}

function TimecardTable({ rows }: { rows: TimecardPdfRowFull[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.th} wrap={false}>
        <Text style={[styles.cell, { width: '8%' }]}>Date</Text>
        <Text style={[styles.cell, { width: '9%' }]}>Tech</Text>
        <Text style={[styles.cell, { width: '9%' }]}>Client</Text>
        <Text style={[styles.cell, { width: '9%' }]}>Location</Text>
        <Text style={[styles.cell, { width: '9%' }]}>Work</Text>
        <Text style={[styles.cell, { width: '10%' }]}>Task</Text>
        <Text style={[styles.cell, { width: '7%' }]}>Start</Text>
        <Text style={[styles.cell, { width: '7%' }]}>End</Text>
        <Text style={[styles.cell, { width: '5%' }]}>Brk</Text>
        <Text style={[styles.cell, { width: '6%' }]}>Hrs</Text>
        <Text style={[styles.cell, { width: '11%' }]}>Bill</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={[styles.cell, { width: '8%' }]}>{r.date}</Text>
          <Text style={[styles.cell, { width: '9%' }]}>{r.technician}</Text>
          <Text style={[styles.cell, { width: '9%' }]}>{r.client}</Text>
          <Text style={[styles.cell, { width: '9%' }]}>{r.location}</Text>
          <Text style={[styles.cell, { width: '9%' }]}>{r.workType}</Text>
          <Text style={[styles.cell, { width: '10%' }]}>{r.task}</Text>
          <Text style={[styles.cell, { width: '7%' }]}>{r.start}</Text>
          <Text style={[styles.cell, { width: '7%' }]}>{r.end}</Text>
          <Text style={[styles.cell, { width: '5%' }]}>{r.breakMin}</Text>
          <Text style={[styles.cell, { width: '6%' }]}>{r.hours}</Text>
          <Text style={[styles.cell, { width: '11%' }]}>{r.billable}</Text>
        </View>
      ))}
    </View>
  )
}

function MaintenanceTable({ rows }: { rows: MaintenanceReportRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.th} wrap={false}>
        <Text style={[styles.cell, { width: '14%' }]}>Client</Text>
        <Text style={[styles.cell, { width: '16%' }]}>Site</Text>
        <Text style={[styles.cell, { width: '11%' }]}>Tech</Text>
        <Text style={[styles.cell, { width: '9%' }]}>Date</Text>
        <Text style={[styles.cell, { width: '9%' }]}>Status</Text>
        <Text style={[styles.cell, { width: '6%' }]}>Doors</Text>
        <Text style={[styles.cell, { width: '18%' }]}>Checklist</Text>
        <Text style={[styles.cell, { width: '17%' }]}>Notes</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={[styles.cell, { width: '14%' }]}>{r.client_name}</Text>
          <Text style={[styles.cell, { width: '16%' }]}>{r.site_location}</Text>
          <Text style={[styles.cell, { width: '11%' }]}>{r.technician_name}</Text>
          <Text style={[styles.cell, { width: '9%' }]}>{r.inspection_date}</Text>
          <Text style={[styles.cell, { width: '9%' }]}>{r.status}</Text>
          <Text style={[styles.cell, { width: '6%' }]}>{String(r.total_doors)}</Text>
          <Text style={[styles.cell, { width: '18%' }]}>{r.checklist_summary}</Text>
          <Text style={[styles.cell, { width: '17%' }]}>{r.issues_preview}</Text>
        </View>
      ))}
    </View>
  )
}

function GpsTable({ rows, includeCoords }: { rows: GpsReportRow[]; includeCoords: boolean }) {
  return (
    <View style={styles.table}>
      <View style={styles.th} wrap={false}>
        <Text style={[styles.cell, { width: includeCoords ? '10%' : '12%' }]}>Date</Text>
        <Text style={[styles.cell, { width: includeCoords ? '12%' : '15%' }]}>Tech</Text>
        <Text style={[styles.cell, { width: includeCoords ? '52%' : '73%' }]}>Location</Text>
        {includeCoords ? (
          <>
            <Text style={[styles.cell, { width: '13%' }]}>S coords</Text>
            <Text style={[styles.cell, { width: '13%' }]}>E coords</Text>
          </>
        ) : null}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={[styles.cell, { width: includeCoords ? '10%' : '12%' }]}>{r.entry_date}</Text>
          <Text style={[styles.cell, { width: includeCoords ? '12%' : '15%' }]}>{r.technician_name}</Text>
          <Text style={[styles.cell, { width: includeCoords ? '52%' : '73%' }]}>{getGpsPrimaryDisplayLocation(r)}</Text>
          {includeCoords ? (
            <>
              <Text style={[styles.cell, { width: '13%' }]}>{r.start_coords ?? '—'}</Text>
              <Text style={[styles.cell, { width: '13%' }]}>{r.end_coords ?? '—'}</Text>
            </>
          ) : null}
        </View>
      ))}
    </View>
  )
}

function QuotesMeta({ q }: { q: QuotesReportSummary }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quotes &amp; revenue (summary)</Text>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Service quotes</Text>
          <Text style={styles.kpiValue}>
            {q.serviceQuotesCount} · ${q.serviceQuotesTotal.toLocaleString()}
          </Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>PVC estimates</Text>
          <Text style={styles.kpiValue}>
            {q.pvcQuotesCount} · ${q.pvcQuotesTotal.toLocaleString()}
          </Text>
        </View>
      </View>
      <Text style={styles.note}>{q.pipelineNote}</Text>
    </View>
  )
}

function ServiceQuotesTable({ rows }: { rows: QuoteServiceLine[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.th} wrap={false}>
        <Text style={[styles.cell, { width: '14%' }]}>Date</Text>
        <Text style={[styles.cell, { width: '14%' }]}>Quote #</Text>
        <Text style={[styles.cell, { width: '44%' }]}>Customer</Text>
        <Text style={[styles.cell, { width: '28%' }]}>Amount</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={[styles.cell, { width: '14%' }]}>{r.createdAtLabel}</Text>
          <Text style={[styles.cell, { width: '14%' }]}>{r.quoteNumber}</Text>
          <Text style={[styles.cell, { width: '44%' }]}>{r.customerName}</Text>
          <Text style={[styles.cell, { width: '28%' }]}>${r.total.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  )
}

function PvcQuotesTable({ rows }: { rows: QuotePvcLine[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.th} wrap={false}>
        <Text style={[styles.cell, { width: '22%' }]}>Date</Text>
        <Text style={[styles.cell, { width: '50%' }]}>PVC quote id</Text>
        <Text style={[styles.cell, { width: '28%' }]}>Amount</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={[styles.cell, { width: '22%' }]}>{r.createdAtLabel}</Text>
          <Text style={[styles.cell, { width: '50%' }]}>{r.id}</Text>
          <Text style={[styles.cell, { width: '28%' }]}>${r.finalPrice.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  )
}

function TrendsTable({ rows }: { rows: QuoteTrendRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.th} wrap={false}>
        <Text style={[styles.cell, { width: '34%' }]}>Week starting</Text>
        <Text style={[styles.cell, { width: '33%' }]}>Service total</Text>
        <Text style={[styles.cell, { width: '33%' }]}>PVC total</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={[styles.cell, { width: '34%' }]}>{r.period}</Text>
          <Text style={[styles.cell, { width: '33%' }]}>${r.service_total.toLocaleString()}</Text>
          <Text style={[styles.cell, { width: '33%' }]}>${r.pvc_total.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  )
}

export function ReportsExportPdfDocument({
  logoSrc,
  dateRangeLabel,
  filterRows,
  summary,
  tab,
  timecardRows,
  timecardGrandTotal,
  maintenanceRows,
  gpsRows,
  gpsIncludeCoords,
  quotes,
  generatedAt,
}: ReportsExportPdfDocumentProps) {
  if (tab === 'timecards') {
    const chunks = splitChunks(timecardRows, 8, 26)
    const pages =
      chunks.length === 0
        ? [
            <Page key="t0" size="A4" style={styles.page}>
              <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
              <FiltersBlock filterRows={filterRows} />
              <TotalsBlock summary={summary} />
              <Text style={styles.sectionTitle}>Timecards</Text>
              <Text style={styles.empty}>No data available for selected filters.</Text>
              <PdfFooter generatedAt={generatedAt} tab={tab} />
            </Page>,
          ]
        : chunks.map((chunk, idx) => (
            <Page key={`t${idx}`} size="A4" style={styles.page}>
              {idx > 0 ? (
                <Text style={styles.continueBar}>Reports &amp; Analytics — continued · Timecards</Text>
              ) : (
                <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
              )}
              {idx === 0 ? <FiltersBlock filterRows={filterRows} /> : null}
              {idx === 0 ? <TotalsBlock summary={summary} /> : null}
              {idx === 0 ? (
                <Text style={styles.sectionTitle}>
                  Timecards · grand total {timecardGrandTotal.toFixed(2)} h
                </Text>
              ) : (
                <Text style={styles.sectionTitle}>Timecards (continued)</Text>
              )}
              <TimecardTable rows={chunk} />
              <PdfFooter generatedAt={generatedAt} tab={tab} />
            </Page>
          ))
    return <Document>{pages}</Document>
  }

  if (tab === 'maintenance') {
    const chunks = splitChunks(maintenanceRows, 9, 28)
    const pages =
      chunks.length === 0
        ? [
            <Page key="m0" size="A4" style={styles.page}>
              <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
              <FiltersBlock filterRows={filterRows} />
              <TotalsBlock summary={summary} />
              <Text style={styles.sectionTitle}>Maintenance reports</Text>
              <Text style={styles.empty}>No data available for selected filters.</Text>
              <PdfFooter generatedAt={generatedAt} tab={tab} />
            </Page>,
          ]
        : chunks.map((chunk, idx) => (
            <Page key={`m${idx}`} size="A4" style={styles.page}>
              {idx > 0 ? (
                <Text style={styles.continueBar}>Reports &amp; Analytics — continued · Maintenance</Text>
              ) : (
                <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
              )}
              {idx === 0 ? <FiltersBlock filterRows={filterRows} /> : null}
              {idx === 0 ? <TotalsBlock summary={summary} /> : null}
              <Text style={styles.sectionTitle}>{idx === 0 ? 'Maintenance reports' : 'Maintenance (continued)'}</Text>
              <MaintenanceTable rows={chunk} />
              <PdfFooter generatedAt={generatedAt} tab={tab} />
            </Page>
          ))
    return <Document>{pages}</Document>
  }

  if (tab === 'gps') {
    const chunks = splitChunks(gpsRows, 10, 30)
    const pages =
      chunks.length === 0
        ? [
            <Page key="g0" size="A4" style={styles.page}>
              <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
              <FiltersBlock filterRows={filterRows} />
              <TotalsBlock summary={summary} />
              <Text style={styles.sectionTitle}>GPS activity</Text>
              <Text style={styles.empty}>No data available for selected filters.</Text>
              <PdfFooter generatedAt={generatedAt} tab={tab} />
            </Page>,
          ]
        : chunks.map((chunk, idx) => (
            <Page key={`g${idx}`} size="A4" style={styles.page}>
              {idx > 0 ? (
                <Text style={styles.continueBar}>Reports &amp; Analytics — continued · GPS</Text>
              ) : (
                <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
              )}
              {idx === 0 ? <FiltersBlock filterRows={filterRows} /> : null}
              {idx === 0 ? <TotalsBlock summary={summary} /> : null}
              <Text style={styles.sectionTitle}>
                {idx === 0 ? `GPS activity${gpsIncludeCoords ? ' (coordinates)' : ''}` : 'GPS (continued)'}
              </Text>
              <GpsTable rows={chunk} includeCoords={gpsIncludeCoords} />
              <PdfFooter generatedAt={generatedAt} tab={tab} />
            </Page>
          ))
    return <Document>{pages}</Document>
  }

  if (tab === 'quotes' && quotes) {
    const { quoteSummary, trends, serviceLines, pvcLines } = quotes
    const svcChunks = splitChunks(serviceLines, 10, 30)
    const pvcChunks = splitChunks(pvcLines, 12, 32)
    const trendChunks = splitChunks(trends, 14, 36)

    const pages: ReactElement[] = []
    let k = 0

    const noDetailRows =
      serviceLines.length === 0 && pvcLines.length === 0 && trends.length === 0

    pages.push(
      <Page key={`q${k++}`} size="A4" style={styles.page}>
        <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
        <FiltersBlock filterRows={filterRows} />
        <TotalsBlock summary={summary} />
        <QuotesMeta q={quoteSummary} />
        {noDetailRows ? (
          <Text style={styles.empty}>No quote line items or weekly trend rows in this date range.</Text>
        ) : null}
        <PdfFooter generatedAt={generatedAt} tab={tab} />
      </Page>
    )

    svcChunks.forEach((chunk, idx) => {
      pages.push(
        <Page key={`q${k++}`} size="A4" style={styles.page}>
          {idx > 0 ? (
            <Text style={styles.continueBar}>Reports &amp; Analytics — continued · Service quotes</Text>
          ) : null}
          <Text style={styles.sectionTitle}>Service quotes ({serviceLines.length})</Text>
          <ServiceQuotesTable rows={chunk} />
          <PdfFooter generatedAt={generatedAt} tab={tab} />
        </Page>
      )
    })

    pvcChunks.forEach((chunk, idx) => {
      pages.push(
        <Page key={`q${k++}`} size="A4" style={styles.page}>
          {idx > 0 ? (
            <Text style={styles.continueBar}>Reports &amp; Analytics — continued · PVC estimates</Text>
          ) : null}
          <Text style={styles.sectionTitle}>PVC estimates ({pvcLines.length})</Text>
          <PvcQuotesTable rows={chunk} />
          <PdfFooter generatedAt={generatedAt} tab={tab} />
        </Page>
      )
    })

    trendChunks.forEach((chunk, idx) => {
      pages.push(
        <Page key={`q${k++}`} size="A4" style={styles.page}>
          {idx > 0 ? (
            <Text style={styles.continueBar}>Reports &amp; Analytics — continued · Weekly trend</Text>
          ) : null}
          <Text style={styles.sectionTitle}>Weekly trend ({trends.length} weeks)</Text>
          <TrendsTable rows={chunk} />
          <PdfFooter generatedAt={generatedAt} tab={tab} />
        </Page>
      )
    })

    return <Document>{pages}</Document>
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <BrandHeader logoSrc={logoSrc} dateRangeLabel={dateRangeLabel} />
        <FiltersBlock filterRows={filterRows} />
        <TotalsBlock summary={summary} />
        <Text style={styles.empty}>Unsupported tab for PDF export.</Text>
        <PdfFooter generatedAt={generatedAt} tab={tab} />
      </Page>
    </Document>
  )
}
