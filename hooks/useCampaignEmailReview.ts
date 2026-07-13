'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { CampaignEmailStats } from '@/lib/sales/review/campaignEmailStatsService'
import type { CampaignGeneratedEmailRow } from '@/lib/sales/review/campaignGeneratedEmailListService'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'

type CampaignResponse = { campaign: SalesCampaign }
type StatsResponse = { stats: CampaignEmailStats }
type RowsResponse = { rows: CampaignGeneratedEmailRow[] }
type TemplatesResponse = { templates: SalesEmailTemplate[] }

export function useCampaignEmailReview(campaignId: string) {
  const [campaign, setCampaign] = useState<SalesCampaign | null>(null)
  const [stats, setStats] = useState<CampaignEmailStats | null>(null)
  const [rows, setRows] = useState<CampaignGeneratedEmailRow[]>([])
  const [activeTemplate, setActiveTemplate] = useState<SalesEmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const [campaignRes, statsRes, rowsRes] = await Promise.all([
      salesEngineFetch<CampaignResponse>(`/api/sales/campaigns/${campaignId}`),
      salesEngineFetch<StatsResponse>(`/api/sales/campaigns/${campaignId}/email-stats`),
      salesEngineFetch<RowsResponse>(`/api/sales/campaigns/${campaignId}/generated-emails`),
    ])
    setCampaign(campaignRes.campaign)
    setStats(statsRes.stats)
    setRows(rowsRes.rows)

    const tpl = await salesEngineFetch<TemplatesResponse>(
      `/api/sales/email-templates?campaignTypeId=${encodeURIComponent(campaignRes.campaign.campaign_type_id)}`,
    )
    setActiveTemplate(tpl.templates.find((t) => t.is_active) ?? null)
  }, [campaignId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await refresh()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load campaign emails')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(() => {
      void refresh().catch(() => {})
    }, 2500)
  }, [refresh, stopPolling])

  useEffect(() => {
    const running = stats?.generationJob?.status === 'running'
    if (running) startPolling()
    else stopPolling()
    return stopPolling
  }, [stats?.generationJob?.status, startPolling, stopPolling])

  const generateAll = useCallback(async () => {
    setGenerating(true)
    try {
      await salesEngineFetch(`/api/sales/campaigns/${campaignId}/generate-emails`, {
        method: 'POST',
        body: JSON.stringify({ processImmediately: true }),
      })
      toast.success('Email generation started')
      startPolling()
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed')
      throw e
    } finally {
      setGenerating(false)
    }
  }, [campaignId, refresh, startPolling])

  return {
    campaign,
    stats,
    rows,
    activeTemplate,
    loading,
    error,
    generating,
    refresh,
    generateAll,
  }
}
