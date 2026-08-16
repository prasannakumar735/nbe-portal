'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

type EmailResponse = { email: SalesGeneratedEmail }
type HistoryResponse = { history: SalesGeneratedEmail[] }

export function useGeneratedEmailActions(campaignId: string, onMutated?: () => void | Promise<void>) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const after = useCallback(async () => {
    if (onMutated) await onMutated()
  }, [onMutated])

  const editEmail = useCallback(
    async (emailId: string, subject: string, body: string) => {
      setBusyId(emailId)
      try {
        await salesEngineFetch<EmailResponse>(`/api/sales/generated-emails/${emailId}`, {
          method: 'PATCH',
          body: JSON.stringify({ subject, body }),
        })
        toast.success('Draft saved')
        await after()
      } finally {
        setBusyId(null)
      }
    },
    [after],
  )

  const approveEmail = useCallback(
    async (emailId: string) => {
      setBusyId(emailId)
      try {
        await salesEngineFetch<EmailResponse>(`/api/sales/generated-emails/${emailId}/approve`, {
          method: 'POST',
        })
        toast.success('Email approved')
        await after()
      } finally {
        setBusyId(null)
      }
    },
    [after],
  )

  const rejectEmail = useCallback(
    async (emailId: string) => {
      setBusyId(emailId)
      try {
        await salesEngineFetch<EmailResponse>(`/api/sales/generated-emails/${emailId}/reject`, {
          method: 'POST',
        })
        toast.success('Email rejected')
        await after()
      } finally {
        setBusyId(null)
      }
    },
    [after],
  )

  const regenerate = useCallback(
    async (contactId: string) => {
      setBusyId(contactId)
      try {
        await salesEngineFetch(
          `/api/sales/campaigns/${campaignId}/contacts/${contactId}/regenerate-email`,
          { method: 'POST', body: JSON.stringify({}) },
        )
        toast.success('Draft regenerated')
        await after()
      } finally {
        setBusyId(null)
      }
    },
    [after, campaignId],
  )

  const bulkApprove = useCallback(
    async (emailIds: string[]) => {
      if (emailIds.length === 0) return
      setBusyId('bulk')
      try {
        const result = await salesEngineFetch<{ succeeded: SalesGeneratedEmail[]; failed: { id: string; reason: string }[] }>(
          '/api/sales/generated-emails/bulk-approve',
          { method: 'POST', body: JSON.stringify({ emailIds }) },
        )
        toast.success(`Approved ${result.succeeded.length} email(s)`)
        if (result.failed.length) {
          toast.error(`${result.failed.length} could not be approved`)
        }
        await after()
      } finally {
        setBusyId(null)
      }
    },
    [after],
  )

  const bulkQueue = useCallback(
    async (generatedEmailIds: string[]) => {
      if (generatedEmailIds.length === 0) return
      setBusyId('queue')
      try {
        const result = await salesEngineFetch<{
          succeeded: unknown[]
          failed: { generatedEmailId: string; reason: string }[]
        }>('/api/sales/email-send-queue/bulk', {
          method: 'POST',
          body: JSON.stringify({ generatedEmailIds }),
        })
        toast.success(`Queued ${result.succeeded.length} email(s) for send`)
        if (result.failed.length) {
          toast.error(`${result.failed.length} could not be queued`)
        }
        await after()
      } finally {
        setBusyId(null)
      }
    },
    [after],
  )

  const loadHistory = useCallback(async (contactId: string) => {
    return salesEngineFetch<HistoryResponse>(
      `/api/sales/campaigns/${campaignId}/generated-emails/${contactId}/history`,
    )
  }, [campaignId])

  return {
    busyId,
    editEmail,
    approveEmail,
    rejectEmail,
    regenerate,
    bulkApprove,
    bulkQueue,
    loadHistory,
  }
}
