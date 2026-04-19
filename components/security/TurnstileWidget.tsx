'use client'

import Script from 'next/script'
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'

/** Minimal typing for Cloudflare’s implicit `cf-turnstile` widget API. */
declare global {
  interface Window {
    turnstile?: {
      reset: (container?: string | HTMLElement) => void
    }
  }
}

export type TurnstileWidgetHandle = { reset: () => void }

type TurnstileWidgetProps = {
  onToken: (token: string) => void
  onExpire?: () => void
  /**
   * Must match `script-src` nonce (middleware `x-nonce`). Required in production because
   * `strict-dynamic` ignores host allowlists — external `api.js` without a nonce is blocked.
   */
  scriptNonce?: string
}

/**
 * Cloudflare Turnstile (free): loads `turnstile/v0/api.js` and renders an implicit widget
 * (`cf-turnstile` + `data-sitekey`). Renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle | null, TurnstileWidgetProps>(
  function TurnstileWidget({ onToken, onExpire, scriptNonce }, ref) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
    const containerRef = useRef<HTMLDivElement>(null)
    const reactId = useId().replace(/:/g, '')
    const callbackName = `__turnstile_cb_${reactId}`
    const expiredName = `__turnstile_exp_${reactId}`

    const onTokenRef = useRef(onToken)
    const onExpireRef = useRef(onExpire)
    useEffect(() => {
      onTokenRef.current = onToken
      onExpireRef.current = onExpire
    }, [onToken, onExpire])

    useLayoutEffect(() => {
      if (!siteKey) return
      const w = window as unknown as Record<string, unknown>
      w[callbackName] = (token: string) => onTokenRef.current(token)
      w[expiredName] = () => onExpireRef.current?.()
      return () => {
        delete w[callbackName]
        delete w[expiredName]
      }
    }, [siteKey, callbackName, expiredName])

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          try {
            const el = containerRef.current
            if (el && window.turnstile) {
              window.turnstile.reset(el)
            }
          } catch {
            /* ignore */
          }
        },
      }),
      [],
    )

    if (!siteKey) return null

    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          // Align with Cloudflare’s embed (non-blocking load); nonce required when `script-src` includes `strict-dynamic`.
          async
          defer
          nonce={scriptNonce}
        />
        <div className="flex justify-center py-1">
          <div
            ref={containerRef}
            className="cf-turnstile"
            data-sitekey={siteKey}
            data-callback={callbackName}
            data-expired-callback={expiredName}
            data-theme="light"
            data-size="normal"
          />
        </div>
      </>
    )
  },
)
