import { isLLMProviderId, type LLMProviderId } from '@/lib/sales/constants/llmProviders'
import {
  PROVIDER_RATE_LIMITS,
  PROVIDER_RATE_LIMIT_WINDOW_MS,
} from '@/lib/sales/rate-limit/providerRateLimits'

export class ProviderRateLimitError extends Error {
  readonly provider: string
  readonly retryAfterMs: number

  constructor(provider: string, retryAfterMs: number) {
    super(`Provider rate limit exceeded for ${provider}. Retry after ${retryAfterMs}ms.`)
    this.name = 'ProviderRateLimitError'
    this.provider = provider
    this.retryAfterMs = retryAfterMs
  }
}

/** In-process sliding window (single Node runtime). Phase 5 may swap for shared store. */
const requestTimestampsByProvider = new Map<string, number[]>()

function resolveProvider(provider: string): LLMProviderId {
  if (!isLLMProviderId(provider)) {
    throw new Error(`Unknown LLM provider for rate limit: ${provider}`)
  }
  return provider
}

function pruneWindow(timestamps: number[], now: number): number[] {
  const cutoff = now - PROVIDER_RATE_LIMIT_WINDOW_MS
  return timestamps.filter((t) => t > cutoff)
}

function getTimestamps(provider: LLMProviderId): number[] {
  const existing = requestTimestampsByProvider.get(provider)
  if (existing) return existing
  const next: number[] = []
  requestTimestampsByProvider.set(provider, next)
  return next
}

export function getProviderRateLimit(provider: string): number {
  const id = resolveProvider(provider)
  return PROVIDER_RATE_LIMITS[id].requestsPerMinute
}

export function getRemainingProviderQuota(provider: string): number {
  const id = resolveProvider(provider)
  const limit = PROVIDER_RATE_LIMITS[id].requestsPerMinute
  const now = Date.now()
  const active = pruneWindow(getTimestamps(id), now)
  requestTimestampsByProvider.set(id, active)
  return Math.max(0, limit - active.length)
}

export function canExecuteProviderRequest(provider: string): boolean {
  return getRemainingProviderQuota(provider) > 0
}

export function recordProviderRequest(provider: string): void {
  const id = resolveProvider(provider)
  if (!canExecuteProviderRequest(id)) {
    const timestamps = getTimestamps(id)
    const oldest = timestamps[0]
    const retryAfterMs =
      oldest != null
        ? Math.max(0, oldest + PROVIDER_RATE_LIMIT_WINDOW_MS - Date.now())
        : PROVIDER_RATE_LIMIT_WINDOW_MS
    throw new ProviderRateLimitError(id, retryAfterMs)
  }
  const now = Date.now()
  const timestamps = pruneWindow(getTimestamps(id), now)
  timestamps.push(now)
  requestTimestampsByProvider.set(id, timestamps)
}

/** Call before LLM invocation; throws {@link ProviderRateLimitError} when throttled. */
export function assertProviderRequestAllowed(provider: string): void {
  if (!canExecuteProviderRequest(provider)) {
    const id = resolveProvider(provider)
    const timestamps = pruneWindow(getTimestamps(id), Date.now())
    const oldest = timestamps[0]
    const retryAfterMs =
      oldest != null
        ? Math.max(0, oldest + PROVIDER_RATE_LIMIT_WINDOW_MS - Date.now())
        : PROVIDER_RATE_LIMIT_WINDOW_MS
    throw new ProviderRateLimitError(id, retryAfterMs)
  }
}

/** Test-only: reset in-memory counters. */
export function resetProviderRateLimitsForTests(): void {
  requestTimestampsByProvider.clear()
}
