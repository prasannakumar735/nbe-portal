'use client'

import { useCallback, useEffect, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { ContactDiscoveryAgentResult } from '@/lib/sales/types/contact.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import { normalizeSalesContactType } from '@/lib/sales/types/contactSources'
import { normalizeContactPageKind } from '@/lib/sales/types/contactDiscovery.types'
import { getSupabaseClient } from '@/lib/supabase'

export type SalesContactDisplayRow = SalesContact & {
  company_name: string
}

export function useContactDiscovery() {
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [progressCompleted, setProgressCompleted] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [contacts, setContacts] = useState<SalesContactDisplayRow[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)

  const loadContacts = useCallback(async (cancelled: () => boolean, businessIds?: string[]) => {
    setContactsLoading(true)
    setContactsError(null)
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from('sales_contacts')
        .select('*')
        .order('confidence_score', { ascending: false })

      if (businessIds && businessIds.length > 0) {
        query = query.in('business_id', businessIds)
      }

      const { data: contactRows, error: contactError } = await query
      if (contactError) throw contactError

      const ids = [...new Set((contactRows ?? []).map((r) => String(r.business_id)))]
      const nameById = new Map<string, string>()
      if (ids.length > 0) {
        const { data: businesses, error: bizError } = await supabase
          .from('sales_businesses')
          .select('id, company_name')
          .in('id', ids)
        if (bizError) throw bizError
        for (const b of businesses ?? []) {
          nameById.set(String(b.id), String(b.company_name))
        }
      }

      const mapped: SalesContactDisplayRow[] = (contactRows ?? []).map((row) => ({
        id: String(row.id),
        business_id: String(row.business_id),
        email: row.email != null ? String(row.email) : null,
        phone: row.phone != null ? String(row.phone) : null,
        contact_page: row.contact_page != null ? String(row.contact_page) : null,
        contact_type: normalizeSalesContactType(String(row.contact_type ?? 'unknown')),
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

      if (!cancelled()) setContacts(mapped)
    } catch (e) {
      if (!cancelled()) {
        setContactsError(e instanceof Error ? e.message : 'Failed to load contacts')
      }
    } finally {
      if (!cancelled()) setContactsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadContacts(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadContacts])

  const fetchSelectedBusinessIds = useCallback(async (): Promise<string[]> => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('sales_businesses').select('id').eq('selected', true)
    if (error) throw error
    return (data ?? []).map((r) => String(r.id))
  }, [])

  const extractContacts = useCallback(async () => {
    setExtractError(null)
    setExtracting(true)
    setProgressCompleted(0)
    setProgressTotal(0)

    try {
      const businessIds = await fetchSelectedBusinessIds()
      if (businessIds.length === 0) {
        setExtractError('Select at least one business.')
        return
      }

      setProgressTotal(businessIds.length)

      for (let i = 0; i < businessIds.length; i++) {
        await salesEngineFetch<ContactDiscoveryAgentResult>('/api/sales/contacts/discover', {
          method: 'POST',
          body: JSON.stringify({
            businessIds: [businessIds[i]],
            processImmediately: true,
          }),
        })
        setProgressCompleted(i + 1)
      }

      let cancelled = false
      await loadContacts(() => cancelled, businessIds)
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : 'Contact extraction failed')
    } finally {
      setExtracting(false)
    }
  }, [fetchSelectedBusinessIds, loadContacts])

  return {
    extracting,
    extractError,
    progressCompleted,
    progressTotal,
    contacts,
    contactsLoading,
    contactsError,
    extractContacts,
    reloadContacts: loadContacts,
  }
}
