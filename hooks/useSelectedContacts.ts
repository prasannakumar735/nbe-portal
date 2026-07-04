'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SalesContactDisplayRow } from '@/hooks/useContactDiscovery'
import {
  outreachPriorityForContact,
  pickRecommendedOutreachContactIds,
} from '@/lib/sales/providers/contactOutreachRanking'

export type ContactReviewGroup = {
  business_id: string
  company_name: string
  contacts: SalesContactDisplayRow[]
}

export function useSelectedContacts(contacts: SalesContactDisplayRow[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const emailContacts = useMemo(
    () => contacts.filter((c) => c.email != null && c.email.trim() !== ''),
    [contacts],
  )

  const emailContactIds = useMemo(
    () => new Set(emailContacts.map((c) => c.id)),
    [emailContacts],
  )

  const recommendedIds = useMemo(
    () =>
      new Set(
        pickRecommendedOutreachContactIds(
          emailContacts.map((c) => ({
            id: c.id,
            business_id: c.business_id,
            email: c.email,
            contact_type: c.contact_type,
            confidence_score: c.confidence_score,
            recommended_for_outreach: c.recommended_for_outreach,
            page_kind: c.page_kind,
            discovery_method: c.discovery_method,
            contact_page: c.contact_page,
            recommended_reason: c.recommended_reason,
          })),
        ),
      ),
    [emailContacts],
  )

  const groups = useMemo((): ContactReviewGroup[] => {
    const byBusiness = new Map<string, ContactReviewGroup>()
    for (const contact of emailContacts) {
      const existing = byBusiness.get(contact.business_id)
      if (existing) {
        existing.contacts.push(contact)
      } else {
        byBusiness.set(contact.business_id, {
          business_id: contact.business_id,
          company_name: contact.company_name,
          contacts: [contact],
        })
      }
    }
    for (const group of byBusiness.values()) {
      group.contacts.sort((a, b) => {
        const diff =
          outreachPriorityForContact({
            id: b.id,
            business_id: b.business_id,
            email: b.email,
            contact_type: b.contact_type,
            confidence_score: b.confidence_score,
            recommended_for_outreach: b.recommended_for_outreach,
            page_kind: b.page_kind,
            discovery_method: b.discovery_method,
          }) -
          outreachPriorityForContact({
            id: a.id,
            business_id: a.business_id,
            email: a.email,
            contact_type: a.contact_type,
            confidence_score: a.confidence_score,
            recommended_for_outreach: a.recommended_for_outreach,
            page_kind: a.page_kind,
            discovery_method: a.discovery_method,
          })
        if (diff !== 0) return diff
        return b.confidence_score - a.confidence_score
      })
    }
    return [...byBusiness.values()].sort((a, b) =>
      a.company_name.localeCompare(b.company_name),
    )
  }, [emailContacts])

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => emailContactIds.has(id)))

      for (const group of groups) {
        if (group.contacts.some((c) => next.has(c.id))) continue
        for (const c of group.contacts) {
          if (recommendedIds.has(c.id)) next.add(c.id)
        }
      }

      return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next
    })
  }, [emailContactIds, groups, recommendedIds])

  const toggleContact = useCallback((contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }, [])

  const selectAllForCompany = useCallback(
    (businessId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const c of emailContacts) {
          if (c.business_id === businessId) next.add(c.id)
        }
        return next
      })
    },
    [emailContacts],
  )

  const unselectAllForCompany = useCallback(
    (businessId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const c of emailContacts) {
          if (c.business_id === businessId) next.delete(c.id)
        }
        return next
      })
    },
    [emailContacts],
  )

  const isSelected = useCallback((contactId: string) => selectedIds.has(contactId), [selectedIds])

  const selectedEmailIds = useMemo(
    () => [...selectedIds].filter((id) => emailContactIds.has(id)),
    [selectedIds, emailContactIds],
  )

  const selectedBusinessIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of emailContacts) {
      if (selectedIds.has(c.id)) ids.add(c.business_id)
    }
    return [...ids]
  }, [emailContacts, selectedIds])

  const selectedEmailCount = selectedEmailIds.length
  const extractedEmailCount = emailContacts.length

  return {
    groups,
    emailContacts,
    recommendedIds,
    extractedEmailCount,
    selectedEmailCount,
    selectedEmailIds,
    selectedBusinessIds,
    isSelected,
    toggleContact,
    selectAllForCompany,
    unselectAllForCompany,
  }
}
