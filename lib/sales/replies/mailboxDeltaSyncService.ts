import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveGraphMailboxUserId } from '@/lib/graph/graphAuth'
import { fetchInboxDeltaPage, getGraphInboxDeltaPageSize } from '@/lib/graph/graphMailClient'
import { importInboundGraphMessage } from '@/lib/sales/replies/inboundImportService'
import { matchInboundGraphMessage } from '@/lib/sales/replies/inboundMessageMatcher'
import {
  getSalesMailboxSyncState,
  upsertSalesMailboxSyncState,
} from '@/lib/sales/repositories/salesMailboxSyncStateRepository'

const INBOX_FOLDER = 'Inbox'

export type MailboxDeltaSyncStats = {
  messagesProcessed: number
  imported: number
  newThreads: number
  existingThreads: number
  duplicatesSkipped: number
  unmatchedSkipped: number
  skippedOther: number
  cursorUpdated: boolean
  deltaMessagesInPage: number
}

function getInboundSyncLookbackMs(): number {
  const hours = Number(process.env.SALES_INBOUND_SYNC_LOOKBACK_HOURS ?? 168)
  if (!Number.isFinite(hours) || hours < 0) return 168 * 60 * 60 * 1000
  return hours * 60 * 60 * 1000
}

function isWithinSyncWindow(
  receivedDateTime: string | undefined,
  lastReceivedAt: string | null,
  lookbackMs: number,
): boolean {
  if (!receivedDateTime?.trim()) return false
  const receivedMs = Date.parse(receivedDateTime)
  if (!Number.isFinite(receivedMs)) return false

  if (lastReceivedAt) {
    const lastMs = Date.parse(lastReceivedAt)
    if (Number.isFinite(lastMs) && receivedMs <= lastMs) {
      return false
    }
  }

  const cutoff = Date.now() - lookbackMs
  return receivedMs >= cutoff
}

export async function runMailboxDeltaSyncPage(
  supabase: SupabaseClient,
  options?: { mailboxUserId?: string; pageSize?: number },
): Promise<MailboxDeltaSyncStats> {
  const mailboxUserId = resolveGraphMailboxUserId(options?.mailboxUserId)
  const pageSize = options?.pageSize ?? getGraphInboxDeltaPageSize()
  const lookbackMs = getInboundSyncLookbackMs()

  const state = await getSalesMailboxSyncState(supabase, mailboxUserId, INBOX_FOLDER)
  const deltaLink = state?.delta_link ?? null
  const lastReceivedAt = state?.last_received_at ?? null

  const page = await fetchInboxDeltaPage({
    mailboxUserId,
    deltaLink,
    pageSize,
  })

  const stats: MailboxDeltaSyncStats = {
    messagesProcessed: 0,
    imported: 0,
    newThreads: 0,
    existingThreads: 0,
    duplicatesSkipped: 0,
    unmatchedSkipped: 0,
    skippedOther: 0,
    cursorUpdated: false,
    deltaMessagesInPage: page.messages.length,
  }

  let maxReceivedAt = lastReceivedAt

  for (const message of page.messages) {
    if (message['@removed']) {
      continue
    }

    if (!isWithinSyncWindow(message.receivedDateTime, lastReceivedAt, lookbackMs)) {
      stats.skippedOther += 1
      continue
    }

    stats.messagesProcessed += 1

    const match = await matchInboundGraphMessage(supabase, message)
    if (!match) {
      stats.unmatchedSkipped += 1
      continue
    }

    const result = await importInboundGraphMessage(supabase, message, match, { mailboxUserId })

    if (result.outcome === 'duplicate') {
      stats.duplicatesSkipped += 1
    } else if (result.outcome === 'skipped') {
      stats.skippedOther += 1
    } else if (result.outcome === 'imported') {
      stats.imported += 1
      if (result.threadCreated) stats.newThreads += 1
      else stats.existingThreads += 1

      const received = message.receivedDateTime?.trim()
      if (received) {
        if (!maxReceivedAt || Date.parse(received) > Date.parse(maxReceivedAt)) {
          maxReceivedAt = received
        }
      }
    }
  }

  if (page.nextCursor) {
    await upsertSalesMailboxSyncState(supabase, {
      mailbox_user_id: mailboxUserId,
      folder: INBOX_FOLDER,
      delta_link: page.nextCursor,
      last_received_at: maxReceivedAt,
      last_error: null,
    })
    stats.cursorUpdated = true
  } else if (page.messages.length === 0) {
    await upsertSalesMailboxSyncState(supabase, {
      mailbox_user_id: mailboxUserId,
      folder: INBOX_FOLDER,
      delta_link: deltaLink,
      last_received_at: maxReceivedAt,
      last_error: null,
    })
  }

  return stats
}
