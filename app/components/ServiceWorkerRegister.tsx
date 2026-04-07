'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

    // Enable SW in production, and also on localhost for testing.
    if (process.env.NODE_ENV !== 'production' && !isLocalhost) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        if (reg.waiting) {
          reg.waiting.postMessage('SKIP_WAITING')
        }
      } catch {
        // non-fatal; offline reload just won't be available
      }
    }

    void register()
  }, [])

  return null
}

