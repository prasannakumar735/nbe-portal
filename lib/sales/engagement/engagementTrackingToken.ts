import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * `engagement` tokens expire (open/click pixels are only interesting for a
 * while). `unsubscribe` tokens must NEVER expire: a recipient who finds a
 * two-year-old email and clicks unsubscribe has to be able to opt out, and an
 * expired link would leave us without a functional unsubscribe facility.
 */
export type EngagementTokenPurpose = 'engagement' | 'unsubscribe'

export type EngagementTrackingPayload = {
  campaignId: string
  contactId: string
  generatedEmailId: string
  /** Absent on non-expiring (unsubscribe) tokens. */
  exp?: number
  /** Absent on tokens issued before purpose scoping; treated as 'engagement'. */
  purpose?: EngagementTokenPurpose
  /**
   * SHA-256 hex digest of the destination URL. Present on click tokens only.
   * The click route verifies the received `?url=` matches this hash to prevent
   * open redirect — any recipient holds a valid engagement token and without
   * this check they can redirect to any URL.
   */
  urlHash?: string
}

function secret(): string {
  const s =
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!s) throw new Error('Missing SALES_ENGAGEMENT_TRACKING_SECRET or CRON_SECRET.')
  return s
}

/**
 * Absolute base URL for links embedded in outbound mail.
 * Throws rather than falling back to '' — a relative unsubscribe URL in an
 * email is a dead link, and a dead unsubscribe link is a compliance breach.
 */
function appBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL is not configured; cannot build tracking or unsubscribe links.')
  }
  return base
}

function encodePayload(payload: EngagementTrackingPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodePayload(encoded: string): EngagementTrackingPayload {
  const json = Buffer.from(encoded, 'base64url').toString('utf8')
  const o = JSON.parse(json) as EngagementTrackingPayload
  if (!o.campaignId || !o.contactId || !o.generatedEmailId) {
    throw new Error('Invalid tracking payload.')
  }
  return o
}

type TrackingTokenSubject = Pick<
  EngagementTrackingPayload,
  'campaignId' | 'contactId' | 'generatedEmailId'
>

export function signEngagementTrackingToken(
  payload: TrackingTokenSubject,
  ttlSeconds: number | null = 60 * 60 * 24 * 90,
  purpose: EngagementTokenPurpose = 'engagement',
): string {
  const full: EngagementTrackingPayload = {
    ...payload,
    purpose,
    ...(ttlSeconds === null ? {} : { exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  }
  const body = encodePayload(full)
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Never-expiring, purpose-scoped token for the unsubscribe facility. */
export function signUnsubscribeToken(payload: TrackingTokenSubject): string {
  return signEngagementTrackingToken(payload, null, 'unsubscribe')
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
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Tracking token expired.')
  }
  return payload
}

/**
 * Verify a token and require it to be an unsubscribe token, so an open-pixel
 * token cannot be replayed against the unsubscribe endpoint (or vice versa).
 */
export function verifyUnsubscribeToken(token: string): EngagementTrackingPayload {
  const payload = verifyEngagementTrackingToken(token)
  if (payload.purpose !== 'unsubscribe') {
    throw new Error('Token is not valid for unsubscribe.')
  }
  return payload
}

export function buildEngagementTrackingUrls(payload: TrackingTokenSubject): {
  openUrl: string
  unsubscribeUrl: string
} {
  const base = appBaseUrl()
  return {
    openUrl: `${base}/api/sales/tracking/open/${signEngagementTrackingToken(payload)}`,
    unsubscribeUrl: `${base}/api/sales/tracking/unsubscribe/${signUnsubscribeToken(payload)}`,
  }
}

/**
 * Build a click-tracking redirect URL.
 *
 * The destination URL is hashed into the token payload so the click route can
 * reject requests where `?url=` was tampered with (open redirect). Without
 * this, every recipient holds a valid engagement token and can redirect any
 * link to any destination.
 */
export function buildClickTrackingUrl(
  payload: TrackingTokenSubject,
  destinationUrl: string,
): string {
  const base = appBaseUrl()
  const urlHash = createHash('sha256').update(destinationUrl).digest('hex')
  const full: EngagementTrackingPayload = {
    ...payload,
    purpose: 'engagement',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90,
    urlHash,
  }
  const body = encodePayload(full)
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  const token = `${body}.${sig}`
  const encoded = encodeURIComponent(destinationUrl)
  return `${base}/api/sales/tracking/click/${token}?url=${encoded}`
}

/**
 * Verify a click token and confirm the received destination URL matches what
 * was signed into the token. Throws if they don't match.
 */
export function verifyClickToken(
  token: string,
  destinationUrl: string,
): EngagementTrackingPayload {
  const payload = verifyEngagementTrackingToken(token)
  if (payload.urlHash) {
    const actual = createHash('sha256').update(destinationUrl).digest('hex')
    if (actual !== payload.urlHash) {
      throw new Error('Click token: destination URL does not match signed hash.')
    }
  }
  return payload
}
