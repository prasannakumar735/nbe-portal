'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // IMPORTANT: do not register Service Worker in development.
    // A previously registered SW can cache stale app-router bundles and trigger dev-only runtime crashes
    // (e.g. OuterLayoutRouter "reading 'get'") that persist across restarts.
    if (process.env.NODE_ENV !== 'production') {
      // Best-effort cleanup: remove any old SW + caches from earlier sessions.
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
        } catch {
          // ignore
        }
        try {
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map(k => caches.delete(k)))
          }
        } catch {
          // ignore
        }
      })()
      return
    }

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

