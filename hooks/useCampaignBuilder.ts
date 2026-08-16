'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { CampaignBuilderFormValues } from '@/components/sales-engine/CampaignBuilderForm'
import {
  loadCampaignBuilderSession,
  type CampaignBuilderSessionPayload,
} from '@/lib/sales/campaignBuilderSession'
import type { CreateSalesCampaignResult } from '@/lib/sales/types/campaign.types'
import type {
  SalesCampaignTypeRecord,
  SalesOfferTypeRecord,
} from '@/lib/sales/types/campaignLookup.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import { normalizeContactPageKind } from '@/lib/sales/types/contactDiscovery.types'
import { getSupabaseClient } from '@/lib/supabase'

export type CampaignContactPreviewRow = SalesContact & {
  company_name: string
}

type FormFieldErrors = Partial<Record<keyof CampaignBuilderFormValues, string>>

type CampaignTypesResponse = { types: SalesCampaignTypeRecord[] }
type OfferTypesResponse = { types: SalesOfferTypeRecord[] }

function validateForm(values: CampaignBuilderFormValues): FormFieldErrors {
  const errors: FormFieldErrors = {}
  if (!values.name.trim()) errors.name = 'Campaign name is required.'
  if (!values.campaignTypeId) errors.campaignTypeId = 'Campaign type is required.'
  if (!values.offerTypeId) errors.offerTypeId = 'Offer type is required.'
  return errors
}

export function useCampaignBuilder() {
  const [session, setSession] = useState<CampaignBuilderSessionPayload | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [previewRows, setPreviewRows] = useState<CampaignContactPreviewRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [campaignTypes, setCampaignTypes] = useState<SalesCampaignTypeRecord[]>([])
  const [offerTypes, setOfferTypes] = useState<SalesOfferTypeRecord[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const [form, setForm] = useState<CampaignBuilderFormValues>({
    name: '',
    campaignTypeId: '',
    offerTypeId: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null)
  const [savedStatus, setSavedStatus] = useState<'draft' | null>(null)

  useEffect(() => {
    setSession(loadCampaignBuilderSession())
    setSessionReady(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setCatalogLoading(true)
      setCatalogError(null)
      try {
        const [campaignRes, offerRes] = await Promise.all([
          salesEngineFetch<CampaignTypesResponse>('/api/sales/campaign-types?activeOnly=true'),
          salesEngineFetch<OfferTypesResponse>('/api/sales/offer-types?activeOnly=true'),
        ])
        if (!cancelled) {
          setCampaignTypes(campaignRes.types)
          setOfferTypes(offerRes.types)
        }
      } catch (e) {
        if (!cancelled) {
          setCatalogError(e instanceof Error ? e.message : 'Failed to load catalog')
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const loadPreview = useCallback(async (isCancelled: () => boolean, emailIds: string[]) => {
    if (emailIds.length === 0) {
      if (!isCancelled()) {
        setPreviewRows([])
        setPreviewLoading(false)
      }
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const supabase = getSupabaseClient()
      const { data: contactRows, error: contactError } = await supabase
        .from('sales_contacts')
        .select('*')
        .in('id', emailIds)
        .order('confidence_score', { ascending: false })
      if (contactError) throw contactError

      const businessIds = [...new Set((contactRows ?? []).map((r) => String(r.business_id)))]
      const nameById = new Map<string, string>()
      if (businessIds.length > 0) {
        const { data: businesses, error: bizError } = await supabase
          .from('sales_businesses')
          .select('id, company_name')
          .in('id', businessIds)
        if (bizError) throw bizError
        for (const b of businesses ?? []) {
          nameById.set(String(b.id), String(b.company_name))
        }
      }

      const mapped: CampaignContactPreviewRow[] = (contactRows ?? []).map((row) => ({
        id: String(row.id),
        business_id: String(row.business_id),
        email: row.email != null ? String(row.email) : null,
        phone: row.phone != null ? String(row.phone) : null,
        contact_page: row.contact_page != null ? String(row.contact_page) : null,
        contact_type: row.contact_type as SalesContact['contact_type'],
        confidence_score: Number(row.confidence_score ?? 50),
        is_primary: Boolean(row.is_primary),
        source: row.source as SalesContact['source'],
        email_verified: Boolean(row.email_verified),
        verification_status: row.verification_status as SalesContact['verification_status'],
        created_at: String(row.created_at),
        discovery_page_title:
          row.discovery_page_title != null ? String(row.discovery_page_title) : null,
        discovery_method:
          row.discovery_method === 'mailto' ||
          row.discovery_method === 'mailto_labeled' ||
          row.discovery_method === 'body_text' ||
          row.discovery_method === 'tel'
            ? row.discovery_method
            : null,
        page_kind: normalizeContactPageKind(
          typeof row.page_kind === 'string' ? row.page_kind : null,
        ),
        recommended_for_outreach: Boolean(row.recommended_for_outreach),
        recommended_reason:
          row.recommended_reason != null ? String(row.recommended_reason) : null,
        discovered_at: String(row.discovered_at ?? row.created_at),
        company_name: nameById.get(String(row.business_id)) ?? '—',
      }))

      if (!isCancelled()) setPreviewRows(mapped)
    } catch (e) {
      if (!isCancelled()) {
        setPreviewError(e instanceof Error ? e.message : 'Failed to load contacts')
      }
    } finally {
      if (!isCancelled()) setPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    let cancelled = false
    void loadPreview(() => cancelled, session?.selectedEmailIds ?? [])
    return () => {
      cancelled = true
    }
  }, [sessionReady, session, loadPreview])

  const audienceCounts = useMemo(
    () => ({
      businesses: session?.selectedBusinessIds.length ?? 0,
      emails: session?.selectedEmailIds.length ?? 0,
    }),
    [session],
  )

  const updateForm = useCallback((patch: Partial<CampaignBuilderFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch) as (keyof CampaignBuilderFormValues)[]) {
        delete next[key]
      }
      return next
    })
  }, [])

  const saveDraft = useCallback(async () => {
    setSaveError(null)
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    if (!session?.selectedEmailIds.length || !session.selectedBusinessIds.length) {
      setSaveError('No audience selected. Return to Sales Engine and select contacts.')
      return
    }

    setSaving(true)
    try {
      const result = await salesEngineFetch<CreateSalesCampaignResult>('/api/sales/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          campaignTypeId: form.campaignTypeId,
          offerTypeId: form.offerTypeId,
          selectedEmailIds: session.selectedEmailIds,
          selectedBusinessIds: session.selectedBusinessIds,
        }),
      })
      setSavedCampaignId(result.campaign.id)
      setSavedStatus('draft')
      toast.success('Campaign Draft Saved Successfully')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save campaign')
    } finally {
      setSaving(false)
    }
  }, [form, session])

  const hasAudience = Boolean(session?.selectedEmailIds.length)
  const formComplete =
    form.name.trim().length > 0 && form.campaignTypeId !== '' && form.offerTypeId !== ''

  return {
    sessionReady,
    hasAudience,
    audienceCounts,
    previewRows,
    previewLoading,
    previewError,
    campaignTypes,
    offerTypes,
    catalogLoading,
    catalogError,
    form,
    updateForm,
    fieldErrors,
    saveError,
    saving,
    savedCampaignId,
    savedStatus,
    saveDraft,
    formComplete,
  }
}

