'use client'

import { useMemo, useSyncExternalStore } from 'react'

/**
 * `window.location.search` as `URLSearchParams` without `useSearchParams()` from `next/navigation`
 * (avoids Next 15+ / OuterLayoutRouter `reading 'get'` crashes on client navigation).
 *
 * Snapshot is the **search string** so `useSyncExternalStore` can bail when the query is unchanged
 * (returning `new URLSearchParams` from getSnapshot each time would re-render every poll).
 */
function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  let last = window.location.search
  const check = () => {
    const s = window.location.search
    if (s !== last) {
      last = s
      callback()
    }
  }
  window.addEventListener('popstate', check)
  // App Router navigations don't fire popstate; poll for actual change only.
  const interval = setInterval(check, 250)
  return () => {
    window.removeEventListener('popstate', check)
    clearInterval(interval)
  }
}

export function useBrowserSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' ? window.location.search : ''),
    () => '',
  )
  return useMemo(() => new URLSearchParams(search), [search])
}
