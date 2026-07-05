/**
 * Read-only Microsoft Graph mail (Inbox delta). No send, writes, or subscriptions.
 */

import { getGraphAccessToken, resolveGraphMailboxUserId } from '@/lib/graph/graphAuth'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

const INBOX_DELTA_SELECT = [
  'id',
  'conversationId',
  'internetMessageId',
  'subject',
  'from',
  'toRecipients',
  'receivedDateTime',
  'body',
  'internetMessageHeaders',
].join(',')

export type GraphInternetMessageHeader = {
  name?: string
  value?: string
}

export type GraphMailRecipient = {
  emailAddress?: { address?: string; name?: string }
}

export type GraphMailMessage = {
  id: string
  conversationId?: string
  internetMessageId?: string
  subject?: string
  from?: GraphMailRecipient
  toRecipients?: GraphMailRecipient[]
  receivedDateTime?: string
  body?: { contentType?: string; content?: string }
  internetMessageHeaders?: GraphInternetMessageHeader[]
  '@removed'?: { reason?: string }
}

export type GraphInboxDeltaPage = {
  messages: GraphMailMessage[]
  /** Persist for the next sync (next page or completed delta token). */
  nextCursor: string | null
}

export function getGraphInboxDeltaPageSize(): number {
  const raw = process.env.SALES_INBOUND_MAIL_SYNC_PAGE_SIZE
  const n = raw ? Number(raw) : 25
  if (!Number.isFinite(n) || n < 1) return 25
  return Math.min(50, Math.max(1, Math.floor(n)))
}

function buildInitialInboxDeltaUrl(userId: string, pageSize: number): string {
  const params = new URLSearchParams({
    $select: INBOX_DELTA_SELECT,
    $top: String(pageSize),
  })
  return `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/mailFolders/inbox/messages/delta?${params}`
}

export async function fetchInboxDeltaPage(options?: {
  mailboxUserId?: string
  deltaLink?: string | null
  pageSize?: number
  timeoutMs?: number
}): Promise<GraphInboxDeltaPage> {
  const userId = resolveGraphMailboxUserId(options?.mailboxUserId)
  const pageSize = options?.pageSize ?? getGraphInboxDeltaPageSize()
  const url =
    options?.deltaLink?.trim() || buildInitialInboxDeltaUrl(userId, pageSize)

  const token = await getGraphAccessToken()
  const timeout = options?.timeoutMs ?? Number(process.env.SALES_INBOUND_GRAPH_TIMEOUT_MS ?? 30_000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'odata.maxpagesize=' + String(pageSize),
      },
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Microsoft Graph inbox delta timed out after ${timeout}ms.`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Microsoft Graph inbox delta failed (${res.status}): ${body}`)
  }

  const json = (await res.json()) as {
    value?: GraphMailMessage[]
    '@odata.nextLink'?: string
    '@odata.deltaLink'?: string
  }

  const nextCursor = json['@odata.nextLink'] ?? json['@odata.deltaLink'] ?? null

  return {
    messages: json.value ?? [],
    nextCursor,
  }
}

export function getHeaderValue(
  headers: GraphInternetMessageHeader[] | undefined,
  name: string,
): string | null {
  if (!headers?.length) return null
  const target = name.toLowerCase()
  for (const h of headers) {
    if (h.name?.toLowerCase() === target && h.value?.trim()) {
      return h.value.trim()
    }
  }
  return null
}

export function normalizeInternetMessageId(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let v = raw.trim()
  if (v.startsWith('<') && v.endsWith('>')) {
    v = v.slice(1, -1)
  }
  return v || null
}

export function parseSenderAddress(message: GraphMailMessage): string | null {
  const addr = message.from?.emailAddress?.address?.trim()
  return addr ? addr.toLowerCase() : null
}

export function parseRecipientAddresses(message: GraphMailMessage): string[] {
  const out: string[] = []
  for (const r of message.toRecipients ?? []) {
    const a = r.emailAddress?.address?.trim()
    if (a) out.push(a)
  }
  return out
}

export function parseInReplyTo(message: GraphMailMessage): string | null {
  const raw = getHeaderValue(message.internetMessageHeaders, 'In-Reply-To')
  return normalizeInternetMessageId(raw)
}

export function parseCorrelationId(message: GraphMailMessage): string | null {
  const raw = getHeaderValue(message.internetMessageHeaders, 'X-NBE-Correlation-Id')
  return raw?.trim() || null
}
