'use client'

import { useCallback, useEffect, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type {
  BusinessDiscoveryScanApiResponse,
  SalesBusiness,
  SalesBusinessListResult,
  SalesBusinessSummary,
} from '@/lib/sales/types/business.types'
import { parsePostcodesInput } from '@/lib/sales/validation'

export function useBusinessScan() {
  const [postcode, setPostcode] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [rows, setRows] = useState<SalesBusiness[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [summary, setSummary] = useState<SalesBusinessSummary | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [lastScanPostcode, setLastScanPostcode] = useState<string | null>(null)
  const [hasScanned, setHasScanned] = useState(false)

  const loadSummary = useCallback(async (cancelled: () => boolean, postcodeFilter?: string) => {
    setSummaryLoading(true)
    try {
      const params = postcodeFilter ? `?postcode=${encodeURIComponent(postcodeFilter)}` : ''
      const data = await salesEngineFetch<SalesBusinessSummary>(
        `/api/sales/businesses/summary${params}`,
      )
      if (!cancelled()) setSummary(data)
    } catch {
      if (!cancelled()) setSummary(null)
    } finally {
      if (!cancelled()) setSummaryLoading(false)
    }
  }, [])

  const loadList = useCallback(
    async (
      cancelled: () => boolean,
      overrides?: { page?: number; pageSize?: number; postcode?: string | null },
    ) => {
      setListLoading(true)
      setListError(null)
      const effectivePage = overrides?.page ?? page
      const effectivePageSize = overrides?.pageSize ?? pageSize
      const postcodeFilter = overrides?.postcode !== undefined ? overrides.postcode : lastScanPostcode
      try {
        const params = new URLSearchParams({
          page: String(effectivePage),
          pageSize: String(effectivePageSize),
        })
        if (postcodeFilter) params.set('postcode', postcodeFilter)
        const data = await salesEngineFetch<SalesBusinessListResult>(
          `/api/sales/businesses?${params.toString()}`,
        )
        if (!cancelled()) {
          setRows(data.rows)
          setTotal(data.total)
          if (overrides?.page != null) setPage(overrides.page)
          if (overrides?.pageSize != null) setPageSize(overrides.pageSize)
        }
      } catch (e) {
        if (!cancelled()) {
          setListError(e instanceof Error ? e.message : 'Failed to load businesses')
        }
      } finally {
        if (!cancelled()) setListLoading(false)
      }
    },
    [page, pageSize, lastScanPostcode],
  )

  useEffect(() => {
    if (!hasScanned || !lastScanPostcode) return
    let cancelled = false
    void loadList(() => cancelled, { postcode: lastScanPostcode })
    return () => {
      cancelled = true
    }
  }, [loadList, hasScanned, lastScanPostcode, page, pageSize])

  useEffect(() => {
    if (!hasScanned || !lastScanPostcode) return
    let cancelled = false
    void loadSummary(() => cancelled, lastScanPostcode)
    return () => {
      cancelled = true
    }
  }, [loadSummary, hasScanned, lastScanPostcode])

  const runScan = useCallback(
    async (refreshFromGoogle: boolean) => {
      setScanError(null)
      let postcodes: string[]
      try {
        postcodes = parsePostcodesInput(postcode)
      } catch (e) {
        setScanError(e instanceof Error ? e.message : 'Invalid postcode')
        return
      }

      const scannedPostcode = postcodes[0]
      setScanning(true)
      try {
        console.info('[businessDiscovery] scan requested', {
          refreshFromGoogle,
          postcodes,
        })
        await salesEngineFetch<BusinessDiscoveryScanApiResponse>('/api/sales/discovery/scan', {
          method: 'POST',
          body: JSON.stringify({ postcodes, refreshFromGoogle }),
        })
        setLastScanPostcode(scannedPostcode)
        setHasScanned(true)
        let cancelled = false
        await loadList(() => cancelled, { page: 1, postcode: scannedPostcode })
        await loadSummary(() => cancelled, scannedPostcode)
      } catch (e) {
        setScanError(e instanceof Error ? e.message : 'Scan failed')
      } finally {
        setScanning(false)
      }
    },
    [postcode, loadList, loadSummary],
  )

  const scan = useCallback(() => runScan(false), [runScan])
  const refreshFromGoogle = useCallback(() => runScan(true), [runScan])

  const toggleSelected = useCallback(
    async (row: SalesBusiness, selected: boolean) => {
      setUpdatingId(row.id)
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, selected } : r)))
      try {
        const updated = await salesEngineFetch<SalesBusiness>(`/api/sales/businesses/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ selected }),
        })
        setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
        let cancelled = false
        await loadSummary(() => cancelled, lastScanPostcode ?? undefined)
      } catch (e) {
        setListError(e instanceof Error ? e.message : 'Update failed')
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, selected: row.selected } : r)),
        )
      } finally {
        setUpdatingId(null)
      }
    },
    [loadSummary, lastScanPostcode],
  )

  return {
    postcode,
    setPostcode,
    scanError,
    listError,
    scanning,
    listLoading,
    summaryLoading,
    rows,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    summary,
    updatingId,
    hasScanned,
    showResultsTable: hasScanned,
    scan,
    refreshFromGoogle,
    toggleSelected,
    reloadList: loadList,
  }
}
