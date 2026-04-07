import { useEffect, useState } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  })

  useEffect(() => {
    const sync = () => {
      if (typeof navigator === 'undefined') return
      setIsOnline(navigator.onLine)
    }

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    // Chrome DevTools "Offline" / captive portals sometimes skip events; re-sync on focus.
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }

    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { isOnline, isOffline: !isOnline }
}

