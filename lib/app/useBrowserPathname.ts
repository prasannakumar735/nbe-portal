'use client'

import { useSyncExternalStore } from 'react'

/**
 * Current `window.location.pathname` without `usePathname()` from `next/navigation`.
 * On Next.js 15+ dev, `usePathname`/`useSearchParams` can race with OuterLayoutRouter
 * and throw `Cannot read properties of undefined (reading 'get')`. App Router soft
 * navigations don't emit `popstate`, so we poll on an interval.
 */
function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  let last = window.location.pathname
  const check = () => {
    const p = window.location.pathname
    if (p !== last) {
      last = p
      onChange()
    }
  }
  window.addEventListener('popstate', check)
  const id = window.setInterval(check, 200)
  return () => {
    window.removeEventListener('popstate', check)
    window.clearInterval(id)
  }
}

function getPathnameSnapshot(): string {
  return typeof window !== 'undefined' ? window.location.pathname : ''
}

export function useBrowserPathname(): string {
  return useSyncExternalStore(subscribe, getPathnameSnapshot, () => '')
}
