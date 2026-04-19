'use client'

import Script from 'next/script'
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

/** Cloudflare Turnstile `render` / `reset` / `remove` (explicit widget lifecycle). */
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact'
        },
      ) => string | undefined
      reset?: (widgetId?: string) => void
      remove?: (widgetId?: string) => void
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
 * Cloudflare Turnstile: loads `turnstile/v0/api.js` and calls `turnstile.render()` on a container.
 * Uses **explicit** rendering so the widget works after client-side navigation (implicit `cf-turnstile`
 * only auto-initializes for nodes present when `api.js` first runs — soft navigations often left the
 * widget blank until a full reload).
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle | null, TurnstileWidgetProps>(
  function TurnstileWidget({ onToken, onExpire, scriptNonce }, ref) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
    const containerRef = useRef<HTMLDivElement>(null)
    const reactId = useId().replace(/:/g, '')
    const widgetIdRef = useRef<string | null>(null)

    const onTokenRef = useRef(onToken)
    const onExpireRef = useRef(onExpire)
    useEffect(() => {
      onTokenRef.current = onToken
      onExpireRef.current = onExpire
    }, [onToken, onExpire])

    /** True once `window.turnstile` is available (script loaded, possibly from a previous route). */
    const [apiReady, setApiReady] = useState(() =>
      typeof window !== 'undefined' ? Boolean(window.turnstile?.render) : false,
    )

    useEffect(() => {
      if (typeof window !== 'undefined' && window.turnstile?.render) {
        setApiReady(true)
      }
    }, [])

    /**
     * `next/script` `onLoad` may not run when `api.js` is already cached (soft navigation), so the
     * widget stayed blank until a full reload. Poll briefly until `turnstile.render` exists.
     */
    useEffect(() => {
      if (!siteKey || typeof window === 'undefined') return
      if (window.turnstile?.render) {
        setApiReady(true)
        return
      }
      let attempts = 0
      const maxAttempts = 150
      const id = window.setInterval(() => {
        attempts += 1
        if (window.turnstile?.render) {
          setApiReady(true)
          window.clearInterval(id)
          return
        }
        if (attempts >= maxAttempts) {
          window.clearInterval(id)
        }
      }, 100)
      return () => window.clearInterval(id)
    }, [siteKey])

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          const id = widgetIdRef.current
          try {
            if (id && window.turnstile?.reset) {
              window.turnstile.reset(id)
            }
          } catch {
            /* ignore */
          }
        },
      }),
      [],
    )

    useEffect(() => {
      if (!siteKey || !apiReady) return
      const el = containerRef.current
      const api = window.turnstile
      if (!el || !api?.render) return

      const id = api.render(el, {
        sitekey: siteKey,
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onExpireRef.current?.(),
        theme: 'light',
        size: 'normal',
      })

      widgetIdRef.current = id ?? null

      return () => {
        const wid = widgetIdRef.current
        widgetIdRef.current = null
        try {
          if (wid && api.remove) {
            api.remove(wid)
          }
        } catch {
          /* ignore */
        }
      }
    }, [siteKey, apiReady])

    if (!siteKey) return null

    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          async
          defer
          nonce={scriptNonce}
          onLoad={() => {
            if (window.turnstile?.render) {
              setApiReady(true)
            }
          }}
        />
        <div className="flex justify-center py-1">
          <div ref={containerRef} className="min-h-[65px] min-w-[300px]" />
        </div>
      </>
    )
  },
)
