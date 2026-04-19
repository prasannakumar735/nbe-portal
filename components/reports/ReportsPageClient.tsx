'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBrowserPathname } from '@/lib/app/useBrowserPathname'
import { useBrowserSearchParams } from '@/lib/app/useBrowserSearchParams'
import { ExternalLink, MapPin } from 'lucide-react'
import {
  filtersToQueryString,
  parseFiltersFromSearchParams,
  parseTab,
} from '@/lib/reports/parseFilters'
import type {
  FilterOptions,
  GpsReportRow,
  MaintenanceReportRow,
  QuotePvcLine,
  QuoteServiceLine,
  QuoteTrendRow,
  QuotesReportSummary,
  ReportsFilters as ReportsFiltersState,
  ReportsSummary,
  ReportsTab,
  TimecardGroupedResponse,
  TimecardReportRow,
} from '@/lib/reports/types'
import { formatEntryTimeRange } from '@/lib/reports/formatTimeRange'
import { getGpsLocationDetailTitle, getGpsPrimaryDisplayLocation } from '@/lib/reports/gpsDisplay'
import {
  locationsForClient,
  mergeCascade,
  reconcileReportsFilters,
} from '@/lib/reports/cascadeFilters'
import { ReportsHeader } from '@/components/reports/ReportsHeader'
import { ReportsFilters as ReportsFiltersPanel } from '@/components/reports/ReportsFilters'
import { ReportsSummaryCards } from '@/components/reports/ReportsSummaryCards'
import { ReportsCharts } from '@/components/reports/ReportsCharts'
import { ReportsInsights } from '@/components/reports/ReportsInsights'
import { ReportsTabs } from '@/components/reports/ReportsTabs'
import { ReportsTable } from '@/components/reports/ReportsTable'
import type { ReportColumn } from '@/components/reports/ReportDataTable'

/** Timecards API always uses day grouping for consistent analytics table */
function qs(filters: ReportsFiltersState, extra: Record<string, string>): string {
  const p = new URLSearchParams(filtersToQueryString(filters))
  Object.entries(extra).forEach(([k, v]) => p.set(k, v))
  return p.toString()
}

/** Prefer lat/lng (technician start → job end); fall back to geocoded addresses */
function googleMapsDirectionsUrl(row: GpsReportRow): string | null {
  const { start_lat, start_lng, end_lat, end_lng, start_address, end_address } = row
  if (start_lat != null && start_lng != null && end_lat != null && end_lng != null) {
    return `https://www.google.com/maps/dir/?api=1&origin=${start_lat},${start_lng}&destination=${end_lat},${end_lng}`
  }
  const a = String(start_address ?? '').trim()
  const b = String(end_address ?? '').trim()
  if (!a || a === '—' || !b || b === '—') return null
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}`
}

const PAGE_SIZE = 25

type QuotesBundle = {
  trends: QuoteTrendRow[]
  summary: QuotesReportSummary
  serviceLines: QuoteServiceLine[]
  pvcLines: QuotePvcLine[]
}

export function ReportsPageClient() {
  const router = useRouter()
  const pathname = useBrowserPathname()
  const searchParams = useBrowserSearchParams()

  const filters = useMemo(
    () => parseFiltersFromSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams]
  )
  const tab = parseTab(searchParams.get('tab'))

  const [refreshKey, setRefreshKey] = useState(0)
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filterOptionsError, setFilterOptionsError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [timecardData, setTimecardData] = useState<TimecardGroupedResponse | null>(null)
  const [maintRows, setMaintRows] = useState<MaintenanceReportRow[] | null>(null)
  const [gpsRows, setGpsRows] = useState<GpsReportRow[] | null>(null)
  const [quotesBundle, setQuotesBundle] = useState<QuotesBundle | null>(null)

  const [bundleLoading, setBundleLoading] = useState(true)
  const [tabErrors, setTabErrors] = useState<Partial<Record<ReportsTab, string>>>({})
  const [showCoords, setShowCoords] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [scopedWorkTypes, setScopedWorkTypes] = useState<FilterOptions['workTypesLevel1']>([])
  const [workTypesLoading, setWorkTypesLoading] = useState(false)

  const pushUrl = useCallback(
    (nextFilters: ReportsFiltersState, nextTab: ReportsTab) => {
      const p = new URLSearchParams(filtersToQueryString(nextFilters))
      p.set('tab', nextTab)
      router.replace(`${pathname}?${p.toString()}`)
    },
    [pathname, router]
  )

  const applyFilterChange = useCallback(
    (next: ReportsFiltersState) => {
      pushUrl(mergeCascade(filters, next), tab)
    },
    [filters, pushUrl, tab]
  )

  const locationOptions = useMemo(
    () => locationsForClient(options?.locations ?? [], filters.clientId),
    [options?.locations, filters.clientId]
  )

  const locationCascadeDisabled = !filters.clientId
  const jobTypeCascadeDisabled = !filters.clientId || !filters.locationId

  /** Deep-link / stale URL repair once filter option lists load */
  useEffect(() => {
    if (!options) return
    const { next, changed } = reconcileReportsFilters(filters, options)
    if (changed) pushUrl(next, tab)
  }, [options, filters, tab, pushUrl])

  useEffect(() => {
    if (!filters.clientId || !filters.locationId) {
      setScopedWorkTypes([])
      setWorkTypesLoading(false)
      return
    }
    setScopedWorkTypes([])
    let cancelled = false
    setWorkTypesLoading(true)
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = qs(filters, {})
          const res = await fetch(`/api/manager/reports/work-types-scope?${q}`, { cache: 'no-store' })
          const raw = (await res.json()) as {
            workTypesLevel1?: FilterOptions['workTypesLevel1']
          }
          if (cancelled) return
          setScopedWorkTypes(Array.isArray(raw.workTypesLevel1) ? raw.workTypesLevel1 : [])
        } catch {
          if (!cancelled) setScopedWorkTypes([])
        } finally {
          if (!cancelled) setWorkTypesLoading(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [filters.clientId, filters.locationId, filters.dateFrom, filters.dateTo, refreshKey])

  useEffect(() => {
    if (workTypesLoading || jobTypeCascadeDisabled) return
    const id = filters.workTypeLevel1Id
    if (!id) return
    if (!scopedWorkTypes.some(w => w.id === id)) {
      pushUrl({ ...filters, workTypeLevel1Id: null }, tab)
    }
  }, [scopedWorkTypes, workTypesLoading, jobTypeCascadeDisabled, filters, tab, pushUrl])

  useEffect(() => {
    if (searchParams.toString().length === 0) {
      const f = parseFiltersFromSearchParams({})
      const p = new URLSearchParams(filtersToQueryString(f))
      p.set('tab', 'timecards')
      router.replace(`${pathname}?${p.toString()}`)
    }
  }, [searchParams, pathname, router])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/manager/reports/filters', { cache: 'no-store' })
        const raw = (await res.json()) as Partial<FilterOptions> & { error?: string }
        if (cancelled) return
        if (!res.ok) {
          setFilterOptionsError(raw.error || `Could not load filters (${res.status})`)
          return
        }
        if (raw.error) {
          setFilterOptionsError(raw.error)
          return
        }
        setFilterOptionsError(null)
        setOptions({
          clients: Array.isArray(raw.clients) ? raw.clients : [],
          technicians: Array.isArray(raw.technicians) ? raw.technicians : [],
          locations: Array.isArray(raw.locations) ? raw.locations : [],
          workTypesLevel1: Array.isArray(raw.workTypesLevel1) ? raw.workTypesLevel1 : [],
        })
      } catch {
        if (!cancelled) {
          setFilterOptionsError('Could not load filter options (network error).')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false
    setSummaryLoading(true)
    const t = setTimeout(() => {
      void (async () => {
        const q = qs(filters, {})
        const res = await fetch(`/api/manager/reports/summary?${q}`)
        if (!res.ok) {
          if (!cancelled) {
            setSummary(null)
            setSummaryLoading(false)
          }
          return
        }
        const data = (await res.json()) as ReportsSummary
        if (!cancelled) {
          setSummary(data)
          setSummaryLoading(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [filters, refreshKey])

  useEffect(() => {
    setTablePage(1)
  }, [filters, tab, showCoords])

  useEffect(() => {
    let cancelled = false
    setBundleLoading(true)
    setTabErrors({})
    const t = setTimeout(() => {
      void (async () => {
        const qBase = qs(filters, { group: 'day' })
        const endpoints: { tab: ReportsTab; url: string }[] = [
          { tab: 'timecards', url: `/api/manager/reports/timecards?${qBase}` },
          { tab: 'maintenance', url: `/api/manager/reports/maintenance?${qs(filters, {})}` },
          { tab: 'gps', url: `/api/manager/reports/gps?${qs(filters, {})}&coords=${showCoords ? '1' : '0'}` },
          { tab: 'quotes', url: `/api/manager/reports/quotes?${qs(filters, {})}` },
        ]

        const results = await Promise.all(
          endpoints.map(async ({ tab: t, url }) => {
            const res = await fetch(url)
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              return { tab: t, ok: false as const, error: typeof err?.error === 'string' ? err.error : 'Request failed' }
            }
            const data = await res.json()
            return { tab: t, ok: true as const, data }
          })
        )

        if (cancelled) return

        const errors: Partial<Record<ReportsTab, string>> = {}
        let tc: TimecardGroupedResponse | null = null
        let mr: MaintenanceReportRow[] | null = null
        let gr: GpsReportRow[] | null = null
        let qb: QuotesBundle | null = null

        for (const r of results) {
          if (!r.ok) {
            errors[r.tab] = r.error
            continue
          }
          if (r.tab === 'timecards') tc = r.data as TimecardGroupedResponse
          else if (r.tab === 'maintenance') mr = (r.data as { rows: MaintenanceReportRow[] }).rows
          else if (r.tab === 'gps') gr = (r.data as { rows: GpsReportRow[] }).rows
          else {
            const d = r.data as {
              trends: QuoteTrendRow[]
              summary: QuotesReportSummary
              serviceLines?: QuoteServiceLine[]
              pvcLines?: QuotePvcLine[]
            }
            qb = {
              trends: d.trends,
              summary: d.summary,
              serviceLines: d.serviceLines ?? [],
              pvcLines: d.pvcLines ?? [],
            }
          }
        }

        setTimecardData(tc)
        setMaintRows(mr)
        setGpsRows(gr)
        setQuotesBundle(qb)
        setTabErrors(errors)
        setBundleLoading(false)
      })()
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [filters, refreshKey, showCoords])

  const tabError = tabErrors[tab] ?? null

  const timecardColumns: ReportColumn<TimecardReportRow & { id: string }>[] = useMemo(
    () => [
      { id: 'date', header: 'Date', accessor: r => r.entry_date, className: 'w-[10%]' },
      { id: 'tech', header: 'Technician', accessor: r => r.technician_name, truncate: true },
      { id: 'client', header: 'Client', accessor: r => r.client_name, truncate: true },
      { id: 'wt', header: 'Work type', accessor: r => r.work_type, truncate: true },
      {
        id: 'time',
        header: 'Time',
        accessor: r => formatEntryTimeRange(r.start_time, r.end_time, r.break_minutes),
        truncate: true,
      },
      { id: 'hrs', header: 'Hours', accessor: r => r.total_hours, numeric: true, className: 'w-[8%]' },
      {
        id: 'bill',
        header: 'Billable',
        accessor: r => r.billable,
        numeric: true,
        className: 'w-[9%]',
        render: r => (
          <span className={r.billable ? 'text-emerald-700' : 'text-slate-500'}>{r.billable ? 'Yes' : 'No'}</span>
        ),
      },
    ],
    []
  )

  const timecardFlat = useMemo(() => {
    if (!timecardData) return []
    const out: (TimecardReportRow & { id: string })[] = []
    timecardData.groups.forEach(g => {
      g.rows.forEach(r => {
        out.push({ ...r, id: r.id })
      })
    })
    return out
  }, [timecardData])

  const timecardPaged = useMemo(() => {
    const start = (tablePage - 1) * PAGE_SIZE
    return timecardFlat.slice(start, start + PAGE_SIZE)
  }, [timecardFlat, tablePage])

  const maintPaged = useMemo(() => {
    if (!maintRows) return []
    const start = (tablePage - 1) * PAGE_SIZE
    return maintRows.slice(start, start + PAGE_SIZE).map(r => ({ ...r, id: r.id }))
  }, [maintRows, tablePage])

  const gpsPaged = useMemo(() => {
    if (!gpsRows) return []
    const start = (tablePage - 1) * PAGE_SIZE
    return gpsRows.slice(start, start + PAGE_SIZE).map(r => ({ ...r, id: r.id }))
  }, [gpsRows, tablePage])

  const quotesPaged = useMemo(() => {
    if (!quotesBundle) return []
    const start = (tablePage - 1) * PAGE_SIZE
    return quotesBundle.trends.slice(start, start + PAGE_SIZE).map((t, i) => ({
      ...t,
      id: `${t.period}-${(tablePage - 1) * PAGE_SIZE + i}`,
    }))
  }, [quotesBundle, tablePage])

  const exportCsv = (type: string) => {
    const extra: Record<string, string> = { type }
    if (type === 'timecards') extra.group = 'day'
    if (type === 'gps' && showCoords) extra.coords = '1'
    window.open(`/api/manager/reports/export/csv?${qs(filters, extra)}`, '_blank', 'noopener,noreferrer')
  }

  const openPdf = () => {
    const extra: Record<string, string> = { tab }
    if (tab === 'gps' && showCoords) extra.coords = '1'
    window.open(`/api/manager/reports/export/pdf?${qs(filters, extra)}`, '_blank', 'noopener,noreferrer')
  }

  const busy = summaryLoading || bundleLoading

  return (
    <div className="mx-auto min-w-0 max-w-[1600px] space-y-6 px-4 py-8 sm:px-6">
      {filterOptionsError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <strong className="font-semibold">Filter options:</strong> {filterOptionsError} Try Refresh. If this
          persists, confirm the server has <code className="rounded bg-amber-100/80 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
          and Supabase URL configured.
        </div>
      ) : null}
      <ReportsHeader
        onExportCsv={() =>
          exportCsv(tab === 'quotes' ? 'quotes' : tab === 'gps' ? 'gps' : tab === 'maintenance' ? 'maintenance' : 'timecards')
        }
        onExportPdf={openPdf}
        onRefresh={() => setRefreshKey(k => k + 1)}
        refreshing={busy}
      />

      <ReportsFiltersPanel
        filters={filters}
        options={options}
        locationOptions={locationOptions}
        workTypeOptions={jobTypeCascadeDisabled ? [] : scopedWorkTypes}
        workTypesLoading={workTypesLoading}
        cascade={{
          locationDisabled: locationCascadeDisabled,
          jobTypeDisabled: jobTypeCascadeDisabled,
        }}
        onChange={applyFilterChange}
      />

      <section aria-label="Summary metrics" className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
        <ReportsSummaryCards summary={summaryLoading ? null : summary} />
        <ReportsInsights summary={summaryLoading ? null : summary} />
        <ReportsCharts summary={summaryLoading ? null : summary} />
      </section>

      <div className="space-y-4">
        <ReportsTabs tab={tab} onTabChange={t => pushUrl(filters, t)} />

        {tab === 'gps' ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={showCoords}
              onChange={e => setShowCoords(e.target.checked)}
            />
            Show raw coordinates (internal)
          </label>
        ) : null}

        <div className="relative min-h-[120px] space-y-4">
          {tab === 'timecards' && timecardData && !bundleLoading && !tabError ? (
            <p className="text-sm text-slate-600">
              Grand total: <strong className="text-slate-900">{timecardData.grandTotalHours} h</strong>
            </p>
          ) : null}

          {tab === 'quotes' && quotesBundle && !bundleLoading && !tabError ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
                <p className="text-xs font-medium uppercase text-slate-500">Service quotes</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{quotesBundle.summary.serviceQuotesCount}</p>
                <p className="text-sm text-slate-600">${quotesBundle.summary.serviceQuotesTotal.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
                <p className="text-xs font-medium uppercase text-slate-500">PVC estimates</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{quotesBundle.summary.pvcQuotesCount}</p>
                <p className="text-sm text-slate-600">${quotesBundle.summary.pvcQuotesTotal.toLocaleString()}</p>
              </div>
              <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/80 p-5 text-sm text-slate-600">
                {quotesBundle.summary.pipelineNote}
              </div>
            </div>
          ) : null}

          {tab === 'timecards' ? (
            <>
              <ReportsTable
                columns={timecardColumns}
                rows={tabError ? null : timecardPaged}
                loading={bundleLoading}
                error={tabError}
                onRetry={() => setRefreshKey(k => k + 1)}
                page={tablePage}
                pageSize={PAGE_SIZE}
                totalRows={timecardFlat.length}
                onPageChange={setTablePage}
              />
              {timecardData && !bundleLoading && !tabError ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {timecardData.groups.map(g => (
                    <div
                      key={g.key}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm shadow-sm ring-1 ring-slate-900/[0.03]"
                    >
                      <p className="font-medium text-slate-800">{g.label}</p>
                      <p className="tabular-nums text-slate-600">Subtotal: {g.subtotalHours} h</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {tab === 'maintenance' ? (
            <ReportsTable
              columns={[
                { id: 'c', header: 'Client', accessor: r => r.client_name, truncate: true },
                { id: 's', header: 'Site', accessor: r => r.site_location, truncate: true },
                { id: 't', header: 'Technician', accessor: r => r.technician_name, truncate: true },
                { id: 'd', header: 'Date', accessor: r => r.inspection_date, className: 'w-[9%]' },
                { id: 'st', header: 'Status', accessor: r => r.status, className: 'w-[8%]' },
                { id: 'chk', header: 'Checklist', accessor: r => r.checklist_summary, truncate: true },
                { id: 'iss', header: 'Issues / notes', accessor: r => r.issues_preview, truncate: true },
                { id: 'att', header: 'Photos', accessor: r => r.attachment_count, numeric: true, className: 'w-[6%]' },
              ]}
              rows={tabError ? null : maintPaged}
              loading={bundleLoading}
              error={tabError}
              onRetry={() => setRefreshKey(k => k + 1)}
              page={tablePage}
              pageSize={PAGE_SIZE}
              totalRows={maintRows?.length ?? 0}
              onPageChange={setTablePage}
            />
          ) : null}

          {tab === 'gps' ? (
            <ReportsTable
              columns={[
                { id: 'd', header: 'Date', accessor: r => r.entry_date, className: 'w-[9%]' },
                { id: 't', header: 'Technician', accessor: r => r.technician_name, truncate: true },
                {
                  id: 'loc',
                  header: 'Location',
                  accessor: r => getGpsPrimaryDisplayLocation(r),
                  truncate: true,
                  render: r => (
                    <span
                      className="inline-flex max-w-full items-center gap-1.5"
                      title={getGpsLocationDetailTitle(r)}
                    >
                      <MapPin className="size-3.5 shrink-0 text-indigo-500" aria-hidden />
                      <span className="truncate">{getGpsPrimaryDisplayLocation(r)}</span>
                    </span>
                  ),
                },
                ...(showCoords
                  ? ([
                      { id: 'c1', header: 'Start coords', accessor: r => r.start_coords ?? '—', className: 'w-[10%]' },
                      { id: 'c2', header: 'End coords', accessor: r => r.end_coords ?? '—', className: 'w-[10%]' },
                    ] as ReportColumn<GpsReportRow & { id: string }>[])
                  : []),
                {
                  id: 'map',
                  header: 'Map',
                  accessor: r => (googleMapsDirectionsUrl(r) ? 'View' : '—'),
                  className: 'w-[120px]',
                  render: r => {
                    const href = googleMapsDirectionsUrl(r)
                    const coordsComplete =
                      r.start_lat != null &&
                      r.start_lng != null &&
                      r.end_lat != null &&
                      r.end_lng != null
                    if (!href) {
                      return (
                        <span className="text-xs text-amber-800" title="Incomplete GPS — add start/end locations on the timecard">
                          Incomplete
                        </span>
                      )
                    }
                    return (
                      <div className="flex flex-col items-end gap-0.5">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-indigo-600 shadow-sm hover:bg-slate-50"
                        >
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                          View
                        </a>
                        {!coordsComplete ? (
                          <span className="text-[10px] text-amber-700" title="Using address search; lat/lng not stored for both ends">
                            Partial route
                          </span>
                        ) : null}
                      </div>
                    )
                  },
                },
              ]}
              rows={tabError ? null : gpsPaged}
              loading={bundleLoading}
              error={tabError}
              onRetry={() => setRefreshKey(k => k + 1)}
              page={tablePage}
              pageSize={PAGE_SIZE}
              totalRows={gpsRows?.length ?? 0}
              onPageChange={setTablePage}
            />
          ) : null}

          {tab === 'quotes' ? (
            <ReportsTable
              columns={[
                { id: 'p', header: 'Week starting', accessor: r => r.period, className: 'w-[28%]' },
                { id: 's', header: 'Service total', accessor: r => r.service_total, numeric: true },
                { id: 'pvc', header: 'PVC total', accessor: r => r.pvc_total, numeric: true },
              ]}
              rows={tabError ? null : quotesPaged}
              loading={bundleLoading}
              error={tabError}
              onRetry={() => setRefreshKey(k => k + 1)}
              page={tablePage}
              pageSize={PAGE_SIZE}
              totalRows={quotesBundle?.trends.length ?? 0}
              onPageChange={setTablePage}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
