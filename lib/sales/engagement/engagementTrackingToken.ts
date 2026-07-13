import { createHmac, timingSafeEqual } from 'node:crypto'

export type EngagementTrackingPayload = {
  campaignId: string
  contactId: string
  generatedEmailId: string
  exp: number
}

function secret(): string {
  const s =
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!s) throw new Error('Missing SALES_ENGAGEMENT_TRACKING_SECRET or CRON_SECRET.')
  return s
}

function encodePayload(payload: EngagementTrackingPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodePayload(encoded: string): EngagementTrackingPayload {
  const json = Buffer.from(encoded, 'base64url').toString('utf8')
  const o = JSON.parse(json) as EngagementTrackingPayload
  if (!o.campaignId || !o.contactId || !o.generatedEmailId || !o.exp) {
    throw new Error('Invalid tracking payload.')
  }
  return o
}

export function signEngagementTrackingToken(
  payload: Omit<EngagementTrackingPayload, 'exp'>,
  ttlSeconds = 60 * 60 * 24 * 90,
): string {
  const full: EngagementTrackingPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = encodePayload(full)
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyEngagementTrackingToken(token: string): EngagementTrackingPayload {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('Invalid tracking token.')
  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid tracking token signature.')
  }
  const payload = decodePayload(body)
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Tracking token expired.')
  }
  return payload
}

export function buildEngagementTrackingUrls(payload: Omit<EngagementTrackingPayload, 'exp'>): {
  openUrl: string
  unsubscribeUrl: string
} {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  const token = signEngagementTrackingToken(payload)
  return {
    openUrl: `${base}/api/sales/tracking/open/${token}`,
    unsubscribeUrl: `${base}/api/sales/tracking/unsubscribe/${token}`,
  }
}
