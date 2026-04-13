/**
 * Browser geolocation helper. Does not throw; returns a discriminated result for production use.
 */

export type CurrentLocationOk = {
  lat: number
  lng: number
  accuracy?: number
}

export type CurrentLocationErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export type GetCurrentLocationResult =
  | ({ ok: true } & CurrentLocationOk)
  | { ok: false; code: CurrentLocationErrorCode }

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
}

/**
 * Resolves with `{ lat, lng }` on success, or `{ ok: false, code }` if unavailable, denied, timed out, or unsupported.
 */
export function getCurrentLocation(options?: PositionOptions): Promise<GetCurrentLocationResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, code: 'unsupported' })
  }

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      err => {
        let code: CurrentLocationErrorCode = 'unavailable'
        if (err.code === err.PERMISSION_DENIED) code = 'denied'
        else if (err.code === err.POSITION_UNAVAILABLE) code = 'unavailable'
        else if (err.code === err.TIMEOUT) code = 'timeout'
        resolve({ ok: false, code })
      },
      { ...DEFAULT_OPTIONS, ...options },
    )
  })
}
